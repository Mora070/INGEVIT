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
  'retirarColaborador: exige al propietario y conserva el usuario y su historial',
  async () => {
    const database = new DatabaseService();
    const rollbackDeLimpieza = new Error(
      'Revertir los datos temporales de la prueba.',
    );

    try {
      await assert.rejects(
        database.withTransaction(async (client) => {
          async function crearUsuario(rol = 'USUARIO') {
            const idUsuario = randomUUID();

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
                  $4::obra.rol_usuario,
                  'ACTIVO'::obra.estado_usuario
                )
              `,
              [
                idUsuario,
                `integracion-${idUsuario}@example.invalid`,
                `google-integracion-${idUsuario}`,
                rol,
              ],
            );

            return idUsuario;
          }

          const idPropietario = await crearUsuario();
          const idColaborador = await crearUsuario();
          const idAdministrador = await crearUsuario('ADMINISTRADOR');

          const repositorio = new ProyectosRepository({
            query: (sql, parametros) => client.query(sql, parametros),
          });

          const actividades = new ActividadesRepository();

          /*
           * Todas las operaciones participan en la transacción exterior.
           * Al finalizar, el error de limpieza revierte los datos de prueba.
           *
           * Esta prueba comprueba el comportamiento con SQL real;
           * no comprueba un COMMIT ni la reversión de una operación fallida.
           */
          const servicio = new ProyectosService(
            repositorio,
            {
              withTransaction: (operacion) => operacion(client),
            },
            actividades,
          );

          const proyecto = await servicio.crear(idPropietario, {
            nombre: 'Proyecto temporal de integración',
            descripcion: 'Prueba de retirada de colaboradores.',
            direccion: 'Dirección temporal',
            contratante: 'Contratante temporal',
            fecha_inicio: '2026-09-10',
            fecha_finalizacion: null,
            estado_proyecto: 'ACTIVA',
            latitud: null,
            longitud: null,
          });

          await servicio.agregarColaborador(
            proyecto.id_proyecto,
            idPropietario,
            idColaborador,
          );

          /*
           * Preparamos una actividad histórica atribuida al colaborador.
           * Es un registro de prueba; no representa una subida real.
           */
          await actividades.crear(client, {
            idProyecto: proyecto.id_proyecto,
            idActor: idColaborador,
            tipoAccion: 'FOTOGRAFIA_SUBIDA',
            mensaje: 'Actividad histórica preparada para la prueba.',
          });

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

          async function consultarRelacion() {
            return client.query(
              `
                SELECT id_usuario, id_proyecto
                FROM obra.usuario_proyecto
                WHERE id_usuario = $1::uuid
                  AND id_proyecto = $2::uuid
              `,
              [idColaborador, proyecto.id_proyecto],
            );
          }

          const historialAnterior = await consultarHistorial();

          const usuarioAnterior = await client.query(
            `
              SELECT id_usuario, correo, rol, estado
              FROM obra.usuarios
              WHERE id_usuario = $1::uuid
            `,
            [idColaborador],
          );

          assert.equal(usuarioAnterior.rowCount, 1);
          assert.equal((await consultarRelacion()).rowCount, 1);

          assert.ok(
            await repositorio.findDisponibleById(
              proyecto.id_proyecto,
              idColaborador,
            ),
          );

          // Ni ser colaborador ni tener rol global de administrador
          // concede permiso para administrar esta relación.
          for (const idActor of [idColaborador, idAdministrador]) {
            await assert.rejects(
              servicio.retirarColaborador(
                proyecto.id_proyecto,
                idActor,
                idColaborador,
              ),
              (error) => {
                assert.equal(error.getStatus(), 404);
                assert.equal(
                  error.message,
                  'El proyecto no está disponible para gestionar colaboradores.',
                );

                return true;
              },
            );
          }

          assert.equal((await consultarRelacion()).rowCount, 1);
          assert.deepEqual(
            await consultarHistorial(),
            historialAnterior,
          );

          // El propietario sí puede retirar al colaborador.
          await servicio.retirarColaborador(
            proyecto.id_proyecto,
            idPropietario,
            idColaborador,
          );

          assert.equal((await consultarRelacion()).rowCount, 0);

          // El antiguo colaborador pierde acceso a este proyecto.
          assert.equal(
            await repositorio.findDisponibleById(
              proyecto.id_proyecto,
              idColaborador,
            ),
            null,
          );

          // La propiedad y disponibilidad del proyecto se conservan.
          const proyectoPosterior =
            await repositorio.findDisponibleById(
              proyecto.id_proyecto,
              idPropietario,
            );

          assert.ok(proyectoPosterior);
          assert.equal(
            proyectoPosterior.id_propietario,
            idPropietario,
          );
          assert.equal(proyectoPosterior.activo, true);

          // Retirar una colaboración no modifica ni elimina la cuenta.
          const usuarioPosterior = await client.query(
            `
              SELECT id_usuario, correo, rol, estado
              FROM obra.usuarios
              WHERE id_usuario = $1::uuid
            `,
            [idColaborador],
          );

          assert.deepEqual(
            usuarioPosterior.rows,
            usuarioAnterior.rows,
          );

          const historialPosterior = await consultarHistorial();

          // Cada actividad anterior debe conservar todos sus campos.
          for (const actividad of historialAnterior) {
            assert.deepEqual(
              historialPosterior.find(
                (actual) =>
                  actual.id_actividad === actividad.id_actividad,
              ),
              actividad,
            );
          }

          const retiradas = historialPosterior.filter(
            (actividad) =>
              actividad.tipo_accion === 'COLABORADOR_RETIRADO',
          );

          assert.equal(
            historialPosterior.length,
            historialAnterior.length + 1,
          );
          assert.equal(retiradas.length, 1);
          assert.equal(retiradas[0].id_actor, idPropietario);
          assert.equal(
            retiradas[0].mensaje,
            `Usuario ${idColaborador} retirado como colaborador.`,
          );

          // Repetir la operación no debe generar una segunda actividad.
          await servicio.retirarColaborador(
            proyecto.id_proyecto,
            idPropietario,
            idColaborador,
          );

          assert.deepEqual(
            await consultarHistorial(),
            historialPosterior,
          );

          throw rollbackDeLimpieza;
        }),
        (error) => error === rollbackDeLimpieza,
      );
    } finally {
      await database.onApplicationShutdown();
    }
  },
);