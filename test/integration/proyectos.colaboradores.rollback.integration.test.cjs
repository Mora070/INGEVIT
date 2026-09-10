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
  'agregarColaborador: revierte la relación si falla el registro de la actividad',
  async () => {
    const database = new DatabaseService();

    // Esta señal permite revertir los datos de preparación al terminar.
    // Se comprueba por identidad para no ocultar errores de la prueba.
    const rollbackDeLimpieza = new Error(
      'Revertir los datos temporales de la prueba.',
    );

    try {
      await assert.rejects(
        database.withTransaction(async (client) => {
          const idPropietario = randomUUID();
          const idColaborador = randomUUID();
          const idActorInexistente = randomUUID();

          // Las cuentas solo existen dentro de la transacción de prueba.
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

          // La preparación reutiliza la transacción exterior.
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
              descripcion: 'Comprobación de atomicidad al agregar colaboradores.',
              direccion: 'Dirección temporal',
              contratante: 'Contratante temporal',
              fecha_inicio: '2026-09-09',
              fecha_finalizacion: null,
              estado_proyecto: 'ACTIVA',
              latitud: null,
              longitud: null,
            },
          );

          const historialAnterior = await client.query(
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

          assert.equal(historialAnterior.rowCount, 1);

          /*
           * El SAVEPOINT permite revertir únicamente la operación evaluada,
           * conservando temporalmente los datos de preparación para comprobar
           * su estado después del fallo.
           *
           * Este adaptador pertenece exclusivamente a la prueba.
           * El servicio real sigue utilizando DatabaseService.withTransaction.
           */
          const transaccionDePrueba = {
            async withTransaction(operacion) {
              await client.query('SAVEPOINT prueba_colaborador');

              try {
                const resultado = await operacion(client);

                await client.query(
                  'RELEASE SAVEPOINT prueba_colaborador',
                );

                return resultado;
              } catch (error) {
                await client.query(
                  'ROLLBACK TO SAVEPOINT prueba_colaborador',
                );

                await client.query(
                  'RELEASE SAVEPOINT prueba_colaborador',
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
              assert.equal(datos.tipoAccion, 'COLABORADOR_AGREGADO');

              // Confirma que la relación se insertó antes de provocar el fallo.
              const relacionDuranteOperacion = await client.query(
                `
                  SELECT id_usuario
                  FROM obra.usuario_proyecto
                  WHERE id_usuario = $1::uuid
                    AND id_proyecto = $2::uuid
                `,
                [idColaborador, proyecto.id_proyecto],
              );

              assert.equal(relacionDuranteOperacion.rowCount, 1);

              seIntentoRegistrarActividad = true;

              /*
               * Provocamos un error real de integridad referencial:
               * la actividad no puede apuntar a un actor inexistente.
               */
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
            servicio.agregarColaborador(
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

          // Después del rollback, el usuario no debe ser colaborador.
          const relacionPosterior = await client.query(
            `
              SELECT id_usuario
              FROM obra.usuario_proyecto
              WHERE id_usuario = $1::uuid
                AND id_proyecto = $2::uuid
            `,
            [idColaborador, proyecto.id_proyecto],
          );

          assert.equal(relacionPosterior.rowCount, 0);

          // El historial previo debe conservarse sin nuevas actividades.
          const historialPosterior = await client.query(
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

          assert.deepEqual(
            historialPosterior.rows,
            historialAnterior.rows,
          );

          // La operación fallida tampoco debe conceder acceso al proyecto.
          const accesoColaborador =
            await repositorio.findDisponibleById(
              proyecto.id_proyecto,
              idColaborador,
            );

          assert.equal(accesoColaborador, null);

          // El proyecto sigue disponible para su propietario.
          const accesoPropietario =
            await repositorio.findDisponibleById(
              proyecto.id_proyecto,
              idPropietario,
            );

          assert.ok(accesoPropietario);
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