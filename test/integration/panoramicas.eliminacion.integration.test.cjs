require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const {
  conAplicacionReal,
} = require('../helpers/con-aplicacion-real.cjs');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  PanoramicasSubidaService,
} = require('../../dist/modules/panoramicas/panoramicas-subida.service');

const {
  PanoramicasEliminacionService,
} = require('../../dist/modules/panoramicas/panoramicas-eliminacion.service');

const {
  ArchivosPendientesService,
} = require('../../dist/modules/almacenamiento/archivos-pendientes.service');

/**
 * Usa PostgreSQL, almacenamiento y servicios reales.
 * El trabajador automático permanece deshabilitado.
 */
test('panorámicas eliminación: registra la tarea y elimina después el archivo físico', async () => {
  await conAplicacionReal(async ({ app, raizTemporal }) => {
    const database = app.get(DatabaseService);
    const subida = app.get(PanoramicasSubidaService);
    const eliminacion = app.get(PanoramicasEliminacionService);
    const procesador = app.get(ArchivosPendientesService);

    const propietario = randomUUID();
    const colaborador = randomUUID();
    const proyecto = randomUUID();
    const usuarios = [propietario, colaborador];

    let clave;

    try {
      // No debemos consumir tareas ajenas a esta prueba.
      const colaInicial = await database.query(`
        SELECT EXISTS (
          SELECT 1 FROM obra.archivos_pendientes_eliminacion
        ) AS ocupada
      `);

      assert.equal(
        colaInicial.rows[0].ocupada,
        false,
        'La prueba requiere una cola vacía; no procesa tareas existentes.',
      );

      await database.withTransaction(async (client) => {
        for (const id of usuarios) {
          await client.query(
            `
              INSERT INTO obra.usuarios (
                id_usuario, correo, google_sub
              )
              VALUES ($1, $2, $3)
            `,
            [id, `${id}@example.invalid`, `integracion-${id}`],
          );
        }

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
            'Eliminación de panorámicas',
            'Dirección temporal',
            'Contratante temporal',
            '2026-09-16',
            'ACTIVA',
          ],
        );

        await client.query(
          `
            INSERT INTO obra.usuario_proyecto (
              id_usuario, id_proyecto
            )
            VALUES ($1, $2)
          `,
          [colaborador, proyecto],
        );
      });

      // Imagen sintética para comprobar persistencia, no contenido 360°.
      const original = await sharp({
        create: {
          width: 400,
          height: 200,
          channels: 3,
          background: { r: 30, g: 80, b: 120 },
        },
      }).png().toBuffer();

      const panoramica = await subida.subir(
        proyecto,
        propietario,
        { titulo: 'Panorámica temporal' },
        original,
      );

      const registro = await database.query(
        `
          SELECT s3_key
          FROM obra.panoramicas
          WHERE id_panoramica = $1
        `,
        [panoramica.id_panoramica],
      );

      assert.equal(registro.rows.length, 1);
      clave = registro.rows[0].s3_key;
      assert.match(clave, /^panoramicas\/[0-9a-f-]{36}\.png$/);

      const rutaArchivo = path.join(
        raizTemporal,
        ...clave.split('/'),
      );

      // Un colaborador con acceso puede eliminar la imagen del propietario.
      await eliminacion.eliminar(
        proyecto,
        panoramica.id_panoramica,
        colaborador,
      );

      const restantes = await database.query(
        `
          SELECT id_panoramica
          FROM obra.panoramicas
          WHERE id_panoramica = $1
        `,
        [panoramica.id_panoramica],
      );

      assert.equal(restantes.rows.length, 0);

      const tarea = await database.query(
        `
          SELECT s3_key
          FROM obra.archivos_pendientes_eliminacion
          WHERE s3_key = $1
        `,
        [clave],
      );

      assert.deepEqual(tarea.rows, [{ s3_key: clave }]);

      // El archivo permanece hasta que el procesador complete la tarea.
      assert.deepEqual(await readFile(rutaArchivo), original);

      await assert.rejects(
        eliminacion.eliminar(
          proyecto,
          panoramica.id_panoramica,
          colaborador,
        ),
        (error) => {
          assert.equal(error.getStatus(), 404);
          assert.equal(error.message, 'La panorámica no está disponible.');
          return true;
        },
      );

      const historial = await database.query(
        `
          SELECT id_actor, tipo_accion, mensaje
          FROM obra.actividades
          WHERE id_proyecto = $1
          ORDER BY tipo_accion
        `,
        [proyecto],
      );

      assert.deepEqual(historial.rows, [
        {
          id_actor: colaborador,
          tipo_accion: 'PANORAMICA_ELIMINADA',
          mensaje: `Panorámica ${panoramica.id_panoramica} eliminada.`,
        },
        {
          id_actor: propietario,
          tipo_accion: 'PANORAMICA_SUBIDA',
          mensaje: `Panorámica ${panoramica.id_panoramica} subida.`,
        },
      ]);

      assert.equal(await procesador.procesarSiguiente(), true);

      await assert.rejects(
        readFile(rutaArchivo),
        { code: 'ENOENT' },
      );

      const tareaFinal = await database.query(
        `
          SELECT s3_key
          FROM obra.archivos_pendientes_eliminacion
          WHERE s3_key = $1
        `,
        [clave],
      );

      assert.equal(tareaFinal.rows.length, 0);

      const proyectoConservado = await database.query(
        'SELECT id_proyecto FROM obra.proyectos WHERE id_proyecto = $1',
        [proyecto],
      );

      assert.equal(proyectoConservado.rows.length, 1);
    } finally {
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
          'DELETE FROM obra.usuarios WHERE id_usuario = ANY($1::uuid[])',
          [usuarios],
        );
      });
    }
  });
});