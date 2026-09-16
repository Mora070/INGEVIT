require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  conAplicacionReal,
} = require('../helpers/con-aplicacion-real.cjs');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  PlanosEliminacionService,
} = require('../../dist/modules/planos/planos-eliminacion.service');

const {
  ActividadesRepository,
} = require('../../dist/modules/actividades/actividades.repository');

/**
 * Provoca un fallo después de eliminar el plano y registrar la tarea.
 *
 * Comprueba que el ROLLBACK restaure también las incidencias eliminadas
 * por cascada y retire la tarea creada dentro de la transacción.
 */
test('planos eliminación: restaura el plano y sus incidencias cuando falla el historial', async (t) => {
  await conAplicacionReal(async ({ app }) => {
    const database = app.get(DatabaseService);
    const eliminacion = app.get(PlanosEliminacionService);
    const actividades = app.get(ActividadesRepository);

    const propietario = randomUUID();
    const proyecto = randomUUID();
    const plano = randomUUID();
    const incidencia = randomUUID();
    const clave = `planos/${randomUUID()}.pdf`;

    let sustituida;
    let estadoIntermedioComprobado = false;

    try {
      await database.withTransaction(async (client) => {
        await client.query(
          `
            INSERT INTO obra.usuarios (
              id_usuario, correo, google_sub
            )
            VALUES ($1, $2, $3)
          `,
          [
            propietario,
            `${propietario}@example.invalid`,
            `integracion-${propietario}`,
          ],
        );

        await client.query(
          `
            INSERT INTO obra.proyectos (
              id_proyecto, id_propietario, nombre, descripcion,
              direccion, contratante, fecha_inicio, estado_proyecto
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            proyecto,
            propietario,
            'Proyecto temporal',
            'Reversión de eliminación',
            'Dirección temporal',
            'Contratante temporal',
            '2026-09-15',
            'ACTIVA',
          ],
        );

        await client.query(
          `
            INSERT INTO obra.planos (
              id_plano, id_proyecto, id_usuario_subida,
              titulo, descripcion, url, s3_key, numero_paginas
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
          `,
          [
            plano,
            proyecto,
            propietario,
            'Plano que debe conservarse',
            'Descripción original',
            '/plano-temporal.pdf',
            clave,
          ],
        );

        await client.query(
          `
            INSERT INTO obra.incidencias (
              id_incidencia, id_plano, id_proyecto, id_creador,
              titulo, descripcion, estado, prioridad,
              coordenada_x, coordenada_y, numero_pagina
            )
            VALUES (
              $1, $2, $3, $4, $5, $6,
              'PENDIENTE', 'MEDIA', 0.5, 0.5, 1
            )
          `,
          [
            incidencia,
            plano,
            proyecto,
            propietario,
            'Incidencia que debe conservarse',
            'Descripción original',
          ],
        );
      });

      const planoOriginal = await database.query(
        'SELECT * FROM obra.planos WHERE id_plano = $1',
        [plano],
      );

      const incidenciaOriginal = await database.query(
        'SELECT * FROM obra.incidencias WHERE id_incidencia = $1',
        [incidencia],
      );

      assert.equal(planoOriginal.rows.length, 1);
      assert.equal(incidenciaOriginal.rows.length, 1);

      sustituida = t.mock.method(
        actividades,
        'crear',
        async (client, datos) => {
          assert.deepEqual(datos, {
            idProyecto: proyecto,
            idActor: propietario,
            tipoAccion: 'PLANO_ELIMINADO',
            mensaje: `Plano ${plano} eliminado.`,
          });

          /*
           * Desde la conexión transaccional comprobamos que:
           * - El plano ya fue eliminado.
           * - La cascada ya eliminó la incidencia.
           * - La tarea del archivo ya está registrada.
           */
          const intermedio = await client.query(
            `
              SELECT
                EXISTS (
                  SELECT 1 FROM obra.planos
                  WHERE id_plano = $1
                ) AS plano,
                EXISTS (
                  SELECT 1 FROM obra.incidencias
                  WHERE id_incidencia = $2
                ) AS incidencia,
                EXISTS (
                  SELECT 1 FROM obra.archivos_pendientes_eliminacion
                  WHERE s3_key = $3
                ) AS tarea
            `,
            [plano, incidencia, clave],
          );

          assert.deepEqual(intermedio.rows, [{
            plano: false,
            incidencia: false,
            tarea: true,
          }]);

          estadoIntermedioComprobado = true;

          // Provoca una violación real de la restricción NOT NULL.
          await client.query(
            `
              INSERT INTO obra.actividades (
                id_proyecto, id_actor, tipo_accion, mensaje
              )
              VALUES ($1, $2, $3, NULL)
            `,
            [proyecto, propietario, 'PLANO_ELIMINADO'],
          );
        },
      );

      await assert.rejects(
        eliminacion.eliminar(proyecto, plano, propietario),
        (error) => {
          assert.equal(error.code, '23502');
          return true;
        },
      );

      assert.equal(estadoIntermedioComprobado, true);

      // Después del ROLLBACK deben recuperarse todas las columnas.
      const planoPosterior = await database.query(
        'SELECT * FROM obra.planos WHERE id_plano = $1',
        [plano],
      );

      const incidenciaPosterior = await database.query(
        'SELECT * FROM obra.incidencias WHERE id_incidencia = $1',
        [incidencia],
      );

      assert.deepEqual(planoPosterior.rows, planoOriginal.rows);
      assert.deepEqual(incidenciaPosterior.rows, incidenciaOriginal.rows);

      const pendientes = await database.query(
        `
          SELECT s3_key
          FROM obra.archivos_pendientes_eliminacion
          WHERE s3_key = $1
        `,
        [clave],
      );

      assert.equal(pendientes.rows.length, 0);

      const historial = await database.query(
        `
          SELECT id_actividad
          FROM obra.actividades
          WHERE id_proyecto = $1
        `,
        [proyecto],
      );

      assert.equal(historial.rows.length, 0);
    } finally {
      if (sustituida) {
        sustituida.mock.restore();
      }

      await database.withTransaction(async (client) => {
        await client.query(
          `
            DELETE FROM obra.archivos_pendientes_eliminacion
            WHERE s3_key = $1
          `,
          [clave],
        );

        await client.query(
          'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
          [proyecto],
        );

        await client.query(
          'DELETE FROM obra.usuarios WHERE id_usuario = $1',
          [propietario],
        );
      });
    }
  });
});