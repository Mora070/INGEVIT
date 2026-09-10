require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  ProyectosRepository,
} = require('../../dist/modules/proyectos/proyectos.repository');

const {
  ProyectosService,
} = require('../../dist/modules/proyectos/proyectos.service');

const {
  ActividadesRepository,
} = require('../../dist/modules/actividades/actividades.repository');

test(
  'retirarColaborador: restaura la relación y el acceso si falla el historial',
  async () => {
    const database = new DatabaseService();

    // Permite limpiar los datos sin ocultar errores de las comprobaciones.
    const rollbackDeLimpieza = new Error(
      'Revertir los datos temporales de la prueba.',
    );

    try {
      await assert.rejects(
        database.withTransaction(async (client) => {
          const idPropietario = randomUUID();
          const idColaborador = randomUUID();
          const idActorInexistente = randomUUID();

          for (const idUsuario of [idPropietario, idColaborador]) {
            await client.query(
              `
                INSERT INTO obra.usuarios (
                  id_usuario,
                  correo,
                  google_sub,
                  rol,
                  estado
                )
                VALUES (
                  $1::uuid,
                  $2,
                  $3,
                  'USUARIO'::obra.rol_usuario,
                  'ACTIVO'::obra.estado_usuario
                )
              `,
              [
                idUsuario,
                `integracion-${idUsuario}@example.invalid`,
                `google-integracion-${idUsuario}`,
              ],
            );
          }

          const repositorio = new ProyectosRepository({
            query: (sql, parametros) => client.query(sql, parametros),
          });

          const actividades = new ActividadesRepository();

          const servicioPreparacion = new ProyectosService(
            repositorio,
            {
              withTransaction: (operacion) => operacion(client),
            },
            actividades,
          );

          const proyecto = await servicioPreparacion.crear(
            idPropietario,
            {
              nombre: 'Proyecto temporal de integración',
              descripcion: 'Prueba de rollback al retirar colaboradores.',
              direccion: 'Dirección temporal',
              contratante: 'Contratante temporal',
              fecha_inicio: '2026-09-10',
              fecha_finalizacion: null,
              estado_proyecto: 'ACTIVA',
              latitud: null,
              longitud: null,
            },
          );

          await servicioPreparacion.agregarColaborador(
            proyecto.id_proyecto,
            idPropietario,
            idColaborador,
          );

          async function consultarRelacion() {
            const resultado = await client.query(
              `
                SELECT id_usuario, id_proyecto
                FROM obra.usuario_proyecto
                WHERE id_usuario = $1::uuid
                  AND id_proyecto = $2::uuid
              `,
              [idColaborador, proyecto.id_proyecto],
            );

            return resultado.rows;
          }

          async function consultarHistorial() {
            const resultado = await client.query(
              `
                SELECT
                  id_actividad,
                  id_proyecto,
                  id_actor,
                  tipo_accion,
                  mensaje,
                  fecha_creacion
                FROM obra.actividades
                WHERE id_proyecto = $1::uuid
                ORDER BY id_actividad
              `,
              [proyecto.id_proyecto],
            );

            return resultado.rows;
          }

          const relacionAnterior = await consultarRelacion();
          const historialAnterior = await consultarHistorial();

          assert.equal(relacionAnterior.length, 1);

          assert.ok(
            await repositorio.findDisponibleById(
              proyecto.id_proyecto,
              idColaborador,
            ),
          );

          /*
           * Aislamos la operación con un SAVEPOINT para poder comprobar
           * su reversión conservando los datos de preparación.
           *
           * Este adaptador solo pertenece a la prueba. No sustituye
           * DatabaseService.withTransaction en el código de producción.
           */
          const transaccionDePrueba = {
            async withTransaction(operacion) {
              await client.query('SAVEPOINT prueba_retirada');

              try {
                const resultado = await operacion(client);

                await client.query(
                  'RELEASE SAVEPOINT prueba_retirada',
                );

                return resultado;
              } catch (error) {
                await client.query(
                  'ROLLBACK TO SAVEPOINT prueba_retirada',
                );

                await client.query(
                  'RELEASE SAVEPOINT prueba_retirada',
                );

                throw error;
              }
            },
          };

          let seIntentoRegistrarActividad = false;

          const actividadesConFallo = {
            async crear(clienteRecibido, datos) {
              assert.strictEqual(clienteRecibido, client);
              assert.equal(datos.idProyecto, proyecto.id_proyecto);
              assert.equal(datos.idActor, idPropietario);
              assert.equal(
                datos.tipoAccion,
                'COLABORADOR_RETIRADO',
              );

              // Confirma que la eliminación ocurrió antes del fallo.
              assert.deepEqual(await consultarRelacion(), []);

              seIntentoRegistrarActividad = true;

              // Provoca una violación real de la clave foránea del actor.
              await actividades.crear(clienteRecibido, {
                ...datos,
                idActor: idActorInexistente,
              });
            },
          };

          const servicio = new ProyectosService(
            repositorio,
            transaccionDePrueba,
            actividadesConFallo,
          );

          await assert.rejects(
            servicio.retirarColaborador(
              proyecto.id_proyecto,
              idPropietario,
              idColaborador,
            ),
            (error) => {
              assert.equal(error.code, '23503');
              assert.equal(
                error.constraint,
                'actividades_id_actor_fkey',
              );

              return true;
            },
          );

          assert.equal(seIntentoRegistrarActividad, true);

          // La relación eliminada debe quedar restaurada.
          assert.deepEqual(
            await consultarRelacion(),
            relacionAnterior,
          );

          // No debe quedar una actividad de retirada ni alterarse el historial.
          assert.deepEqual(
            await consultarHistorial(),
            historialAnterior,
          );

          // Al restaurarse la relación, el colaborador conserva su acceso.
          const accesoColaborador =
            await repositorio.findDisponibleById(
              proyecto.id_proyecto,
              idColaborador,
            );

          assert.ok(accesoColaborador);
          assert.equal(
            accesoColaborador.id_proyecto,
            proyecto.id_proyecto,
          );

          const accesoPropietario =
            await repositorio.findDisponibleById(
              proyecto.id_proyecto,
              idPropietario,
            );

          assert.ok(accesoPropietario);
          assert.equal(
            accesoPropietario.id_propietario,
            idPropietario,
          );
          assert.equal(accesoPropietario.activo, true);

          throw rollbackDeLimpieza;
        }),
        (error) => error === rollbackDeLimpieza,
      );
    } finally {
      await database.onApplicationShutdown();
    }
  },
);