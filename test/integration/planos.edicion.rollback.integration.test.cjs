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
  PlanosEdicionService,
} = require('../../dist/modules/planos/planos-edicion.service');

const {
  ActividadesRepository,
} = require('../../dist/modules/actividades/actividades.repository');

/**
 * Provoca un fallo real al insertar la actividad y comprueba
 * que PostgreSQL revierta la actualización previa del plano.
 *
 * No crea un PDF físico: esta operación solo modifica metadatos.
 */
test('planos edición: conserva los datos originales cuando falla el historial', async (t) => {
  await conAplicacionReal(async ({ app }) => {
    const database = app.get(DatabaseService);
    const edicion = app.get(PlanosEdicionService);
    const actividades = app.get(ActividadesRepository);

    const propietario = randomUUID();
    const proyecto = randomUUID();
    const plano = randomUUID();

    let sustituida;
    let actualizacionObservada = false;

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
            'Reversión de edición',
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
              titulo, descripcion, url, s3_key
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            plano,
            proyecto,
            propietario,
            'Título original',
            'Descripción original',
            `/api/proyectos/${proyecto}/planos/archivos/${plano}.pdf`,
            `planos/${plano}.pdf`,
          ],
        );
      });

      const consultaOriginal = await database.query(
        'SELECT * FROM obra.planos WHERE id_plano = $1',
        [plano],
      );

      assert.equal(consultaOriginal.rows.length, 1);
      const original = consultaOriginal.rows[0];

      sustituida = t.mock.method(
        actividades,
        'crear',
        async (client, datos) => {
          assert.deepEqual(datos, {
            idProyecto: proyecto,
            idActor: propietario,
            tipoAccion: 'PLANO_DATOS_GUARDADOS',
            mensaje: `Datos del plano ${plano} guardados.`,
          });

          /*
           * Esta conexión debe observar la actualización pendiente.
           * Así comprobamos que el fallo sucede después del UPDATE.
           */
          const actual = await client.query(
            `
              SELECT titulo, descripcion
              FROM obra.planos
              WHERE id_plano = $1
            `,
            [plano],
          );

          assert.deepEqual(actual.rows, [{
            titulo: 'Título que debe revertirse',
            descripcion: 'Descripción que debe revertirse',
          }]);

          actualizacionObservada = true;

          // mensaje es NOT NULL: PostgreSQL debe rechazar la inserción.
          await client.query(
            `
              INSERT INTO obra.actividades (
                id_proyecto, id_actor, tipo_accion, mensaje
              )
              VALUES ($1, $2, $3, NULL)
            `,
            [
              proyecto,
              propietario,
              'PLANO_DATOS_GUARDADOS',
            ],
          );
        },
      );

      await assert.rejects(
        edicion.actualizarDatos(
          proyecto,
          plano,
          propietario,
          {
            titulo: 'Título que debe revertirse',
            descripcion: 'Descripción que debe revertirse',
          },
        ),
        (error) => {
          assert.equal(error.code, '23502');
          return true;
        },
      );

      assert.equal(actualizacionObservada, true);

      /*
       * Después del ROLLBACK, una consulta mediante el pool debe
       * devolver todas las columnas con sus valores originales.
       */
      const posterior = await database.query(
        'SELECT * FROM obra.planos WHERE id_plano = $1',
        [plano],
      );

      assert.deepEqual(posterior.rows, [original]);

      const historial = await database.query(
        `
          SELECT COUNT(*)::text AS total
          FROM obra.actividades
          WHERE id_proyecto = $1
        `,
        [proyecto],
      );

      assert.deepEqual(historial.rows, [{ total: '0' }]);
    } finally {
      if (sustituida) {
        sustituida.mock.restore();
      }

      await database.withTransaction(async (client) => {
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