require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const {
  conAplicacionReal,
} = require('../helpers/con-aplicacion-real.cjs');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  ActividadesRepository,
} = require('../../dist/modules/actividades/actividades.repository');

const {
  PanoramicasSubidaService,
} = require('../../dist/modules/panoramicas/panoramicas-subida.service');

const {
  PanoramicasEdicionService,
} = require('../../dist/modules/panoramicas/panoramicas-edicion.service');

const {
  PanoramicasEliminacionService,
} = require('../../dist/modules/panoramicas/panoramicas-eliminacion.service');

/**
 * Cada escenario utiliza su propia aplicación, carpeta y registros.
 * Solo sustituimos el registro de actividad para provocar el fallo.
 */
for (const operacion of ['subida', 'edicion', 'eliminacion']) {
  test(`panorámicas ${operacion}: revierte los cambios cuando falla el historial`, async (t) => {
    await conAplicacionReal(async ({ app, raizTemporal }) => {
      const database = app.get(DatabaseService);
      const subida = app.get(PanoramicasSubidaService);
      const edicion = app.get(PanoramicasEdicionService);
      const eliminacion = app.get(PanoramicasEliminacionService);
      const actividades = app.get(ActividadesRepository);

      const usuario = randomUUID();
      const proyecto = randomUUID();
      const carpeta = path.join(raizTemporal, 'panoramicas');

      let sustituida;
      let clave;
      let falloObservado = false;

      try {
        await database.withTransaction(async (client) => {
          await client.query(
            `
              INSERT INTO obra.usuarios (
                id_usuario, correo, google_sub
              )
              VALUES ($1, $2, $3)
            `,
            [usuario, `${usuario}@example.invalid`, `integracion-${usuario}`],
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
              usuario,
              'Proyecto temporal',
              'Reversión de panorámicas',
              'Dirección temporal',
              'Contratante temporal',
              '2026-09-16',
              'ACTIVA',
            ],
          );
        });

        const contenido = await sharp({
          create: {
            width: 400,
            height: 200,
            channels: 3,
            background: { r: 30, g: 80, b: 120 },
          },
        }).png().toBuffer();

        let panoramica;

        // Edición y eliminación necesitan una subida ya confirmada.
        if (operacion !== 'subida') {
          panoramica = await subida.subir(
            proyecto,
            usuario,
            { titulo: 'Título original' },
            contenido,
          );
        }

        const registrosOriginales = await database.query(
          'SELECT * FROM obra.panoramicas WHERE id_proyecto = $1',
          [proyecto],
        );

        if (panoramica) {
          assert.equal(registrosOriginales.rows.length, 1);
          clave = registrosOriginales.rows[0].s3_key;
        }

        const historialOriginal = await database.query(
          `
            SELECT * FROM obra.actividades
            WHERE id_proyecto = $1
            ORDER BY id_actividad
          `,
          [proyecto],
        );

        sustituida = t.mock.method(
          actividades,
          'crear',
          async (client, datos) => {
            const tipos = {
              subida: 'PANORAMICA_SUBIDA',
              edicion: 'PANORAMICA_TITULO_GUARDADO',
              eliminacion: 'PANORAMICA_ELIMINADA',
            };

            assert.equal(datos.tipoAccion, tipos[operacion]);
            assert.equal(datos.idProyecto, proyecto);
            assert.equal(datos.idActor, usuario);

            const durante = await client.query(
              'SELECT * FROM obra.panoramicas WHERE id_proyecto = $1',
              [proyecto],
            );

            if (operacion === 'eliminacion') {
              assert.equal(durante.rows.length, 0);

              const tarea = await client.query(
                `
                  SELECT s3_key
                  FROM obra.archivos_pendientes_eliminacion
                  WHERE s3_key = $1
                `,
                [clave],
              );

              assert.deepEqual(tarea.rows, [{ s3_key: clave }]);
            } else {
              assert.equal(durante.rows.length, 1);
              clave = durante.rows[0].s3_key;

              assert.equal(
                durante.rows[0].titulo,
                operacion === 'subida'
                  ? 'Título original'
                  : 'Título que debe revertirse',
              );
            }

            assert.match(
              clave,
              /^panoramicas\/[0-9a-f-]{36}\.png$/,
            );

            // El original todavía debe existir al provocar el fallo.
            assert.deepEqual(
              await readFile(path.join(raizTemporal, ...clave.split('/'))),
              contenido,
            );

            falloObservado = true;

            // mensaje es NOT NULL: PostgreSQL aborta la transacción.
            await client.query(
              `
                INSERT INTO obra.actividades (
                  id_proyecto, id_actor, tipo_accion, mensaje
                )
                VALUES ($1, $2, $3, NULL)
              `,
              [proyecto, usuario, datos.tipoAccion],
            );
          },
        );

        const ejecutar = () => {
          if (operacion === 'subida') {
            return subida.subir(
              proyecto,
              usuario,
              { titulo: 'Título original' },
              contenido,
            );
          }

          if (operacion === 'edicion') {
            return edicion.actualizarTitulo(
              proyecto,
              panoramica.id_panoramica,
              usuario,
              'Título que debe revertirse',
            );
          }

          return eliminacion.eliminar(
            proyecto,
            panoramica.id_panoramica,
            usuario,
          );
        };

        await assert.rejects(
          ejecutar(),
          (error) => error.code === '23502',
        );

        assert.equal(falloObservado, true);

        const posteriores = await database.query(
          'SELECT * FROM obra.panoramicas WHERE id_proyecto = $1',
          [proyecto],
        );

        assert.deepEqual(posteriores.rows, registrosOriginales.rows);

        const historialPosterior = await database.query(
          `
            SELECT * FROM obra.actividades
            WHERE id_proyecto = $1
            ORDER BY id_actividad
          `,
          [proyecto],
        );

        assert.deepEqual(
          historialPosterior.rows,
          historialOriginal.rows,
        );

        const pendientes = await database.query(
          `
            SELECT s3_key
            FROM obra.archivos_pendientes_eliminacion
            WHERE s3_key = $1
          `,
          [clave],
        );

        assert.equal(pendientes.rows.length, 0);

        if (operacion === 'subida') {
          // La compensación elimina el archivo recién escrito.
          assert.deepEqual(await readdir(carpeta), []);
        } else {
          // Una edición o eliminación revertida conserva el original.
          assert.deepEqual(
            await readFile(path.join(raizTemporal, ...clave.split('/'))),
            contenido,
          );
        }
      } finally {
        if (sustituida) sustituida.mock.restore();

        await database.withTransaction(async (client) => {
          if (clave) {
            await client.query(
              `
                DELETE FROM obra.archivos_pendientes_eliminacion
                WHERE s3_key = $1
              `,
              [clave],
            );
          }

          await client.query(
            'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
            [proyecto],
          );

          await client.query(
            'DELETE FROM obra.usuarios WHERE id_usuario = $1',
            [usuario],
          );
        });
      }
    });
  });
}