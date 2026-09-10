require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

test(
  'actividades: protege el historial y permite su eliminación en cascada con el proyecto',
  async () => {
    const database = new DatabaseService();
    const rollbackDeLimpieza = new Error(
      'Revertir los datos temporales de la prueba.',
    );

    try {
      await assert.rejects(
        database.withTransaction(async (client) => {
          const idUsuario = randomUUID();
          const idProyecto = randomUUID();
          const idActividad = randomUUID();

          await client.query(
            `
              INSERT INTO obra.usuarios (
                id_usuario, correo, google_sub, rol, estado
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

          await client.query(
            `
              INSERT INTO obra.proyectos (
                id_proyecto,
                id_propietario,
                nombre,
                descripcion,
                direccion,
                contratante,
                fecha_inicio,
                estado_proyecto
              )
              VALUES (
                $1::uuid,
                $2::uuid,
                'Proyecto temporal de protección',
                'Preparación de prueba',
                'Dirección temporal',
                'Contratante temporal',
                '2026-09-10'::date,
                'ACTIVA'::obra.estado_proyecto
              )
            `,
            [idProyecto, idUsuario],
          );

          await client.query(
            `
              INSERT INTO obra.actividades (
                id_actividad,
                id_proyecto,
                id_actor,
                tipo_accion,
                mensaje
              )
              VALUES (
                $1::uuid,
                $2::uuid,
                $3::uuid,
                'PROYECTO_CREADO',
                'Proyecto creado.'
              )
            `,
            [idActividad, idProyecto, idUsuario],
          );

          async function consultarActividad() {
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
                WHERE id_actividad = $1::uuid
              `,
              [idActividad],
            );

            return resultado.rows;
          }

          const actividadOriginal = await consultarActividad();
          assert.equal(actividadOriginal.length, 1);

          /**
           * Una sentencia rechazada deja la transacción en estado de error.
           * El SAVEPOINT permite recuperarla después de cada comprobación.
           *
           * También revierte la operación si, inesperadamente, llega a
           * ejecutarse sin error, antes de propagar el fallo de la prueba.
           */
          async function comprobarOperacionProtegida(sql, parametros = []) {
            await client.query('SAVEPOINT proteccion_historial');

            try {
              await assert.rejects(
                client.query(sql, parametros),
                (error) => {
                  assert.equal(error.code, '23514');
                  return true;
                },
              );
            } finally {
              await client.query(
                'ROLLBACK TO SAVEPOINT proteccion_historial',
              );
              await client.query(
                'RELEASE SAVEPOINT proteccion_historial',
              );
            }

            assert.deepEqual(
              await consultarActividad(),
              actividadOriginal,
            );
          }

          await comprobarOperacionProtegida(
            `
              UPDATE obra.actividades
              SET mensaje = 'Modificación que debe rechazarse'
              WHERE id_actividad = $1::uuid
            `,
            [idActividad],
          );

          await comprobarOperacionProtegida(
            `
              DELETE FROM obra.actividades
              WHERE id_actividad = $1::uuid
            `,
            [idActividad],
          );

          /*
           * No ejecutamos TRUNCATE sobre la tabla real.
           *
           * Creamos una tabla temporal vacía y conectamos la función real
           * mediante un trigger equivalente para comprobar esa rama sin
           * intentar vaciar el historial de otros proyectos.
           */
          await client.query(`
            CREATE TEMP TABLE prueba_historial_truncate (
              id_actividad uuid
            ) ON COMMIT DROP
          `);

          await client.query(`
            CREATE TRIGGER proteger_truncate_prueba
            BEFORE TRUNCATE ON prueba_historial_truncate
            FOR EACH STATEMENT
            EXECUTE FUNCTION obra.proteger_actividades()
          `);

          await comprobarOperacionProtegida(
            'TRUNCATE TABLE pg_temp.prueba_historial_truncate',
          );

          // La eliminación lógica debe conservar la actividad.
          await client.query(
            `
              UPDATE obra.proyectos
              SET activo = false
              WHERE id_proyecto = $1::uuid
            `,
            [idProyecto],
          );

          assert.deepEqual(
            await consultarActividad(),
            actividadOriginal,
          );

          // Incluso eliminado lógicamente, el proyecto todavía existe.
          await comprobarOperacionProtegida(
            `
              DELETE FROM obra.actividades
              WHERE id_actividad = $1::uuid
            `,
            [idActividad],
          );

          /*
           * Eliminamos únicamente el proyecto temporal.
           * Esta comprobación evalúa la cascada de PostgreSQL;
           * no representa una autorización HTTP de administrador.
           */
          const eliminacion = await client.query(
            `
              DELETE FROM obra.proyectos
              WHERE id_proyecto = $1::uuid
            `,
            [idProyecto],
          );

          assert.equal(eliminacion.rowCount, 1);
          assert.deepEqual(await consultarActividad(), []);

          // El borrado del proyecto no debe eliminar al usuario.
          const usuario = await client.query(
            `
              SELECT id_usuario
              FROM obra.usuarios
              WHERE id_usuario = $1::uuid
            `,
            [idUsuario],
          );

          assert.equal(usuario.rowCount, 1);

          throw rollbackDeLimpieza;
        }),
        (error) => error === rollbackDeLimpieza,
      );
    } finally {
      await database.onApplicationShutdown();
    }
  },
);