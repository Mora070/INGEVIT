require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { Readable } = require('node:stream');
const path = require('node:path');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  AlmacenamientoLocalService,
} = require('../../dist/modules/almacenamiento/almacenamiento-local.service');

const {
  ArchivosPendientesRepository,
} = require('../../dist/modules/almacenamiento/archivos-pendientes.repository');

const {
  ArchivosPendientesService,
} = require('../../dist/modules/almacenamiento/archivos-pendientes.service');

test(
  'procesamiento pendiente: elimina un archivo real y completa una tarea cuyo archivo ya no existe',
  async () => {
    const raizTemporal = await mkdtemp(
      path.join(tmpdir(), 'ingevit-pendientes-'),
    );

    const raizAnterior = process.env.STORAGE_LOCAL_ROOT;

    const claveExistente = `fotografias/${randomUUID()}.webp`;
    const claveAusente = `fotografias/${randomUUID()}.jpeg`;
    const claves = [claveExistente, claveAusente];

    let database;
    let conexionInicializada = false;

    try {
      process.env.STORAGE_LOCAL_ROOT = raizTemporal;

      database = new DatabaseService();
      await database.onModuleInit();
      conexionInicializada = true;

      /*
       * El servicio selecciona tareas de la cola compartida.
       * No ejecutamos la prueba si ya hay pendientes ajenos.
       */
      const existentes = await database.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM obra.archivos_pendientes_eliminacion
          ) AS hay_pendientes
        `,
      );

      assert.equal(
        existentes.rows[0].hay_pendientes,
        false,
        'Esta prueba requiere una cola vacía. No procesa tareas existentes.',
      );

      const almacenamiento = new AlmacenamientoLocalService();
      await almacenamiento.onModuleInit();

      const pendientes = new ArchivosPendientesRepository();

      const servicio = new ArchivosPendientesService(
        database,
        pendientes,
        almacenamiento,
      );

      /*
       * El procesador elimina archivos sin interpretar sus píxeles.
       * Estos bytes son suficientes para comprobar el almacenamiento.
       */
      const contenido = Buffer.from('Archivo temporal de integración');
      const entrada = Readable.from([contenido]);

      try {
        await almacenamiento.guardar(claveExistente, entrada);
      } finally {
        entrada.destroy();
      }

      const rutaExistente = path.join(
        raizTemporal,
        ...claveExistente.split('/'),
      );

      assert.deepEqual(
        await readFile(rutaExistente),
        contenido,
      );

      // La segunda clave representa un archivo borrado previamente.
      await assert.rejects(
        () =>
          readFile(
            path.join(raizTemporal, ...claveAusente.split('/')),
          ),
        { code: 'ENOENT' },
      );

      await database.withTransaction((client) =>
        pendientes.registrar(client, claves),
      );

      /*
       * No dependemos de cuál clave aparezca primero en el orden.
       * Ambas tareas deben completarse correctamente.
       */
      assert.equal(await servicio.procesarSiguiente(), true);

      const trasPrimera = await database.query(
        `
          SELECT s3_key
          FROM obra.archivos_pendientes_eliminacion
          WHERE s3_key = ANY($1::text[])
        `,
        [claves],
      );

      assert.equal(trasPrimera.rowCount, 1);

      assert.equal(await servicio.procesarSiguiente(), true);

      const trasSegunda = await database.query(
        `
          SELECT s3_key
          FROM obra.archivos_pendientes_eliminacion
          WHERE s3_key = ANY($1::text[])
        `,
        [claves],
      );

      assert.equal(trasSegunda.rowCount, 0);

      await assert.rejects(
        () => readFile(rutaExistente),
        { code: 'ENOENT' },
      );

      assert.equal(await servicio.procesarSiguiente(), false);
    } finally {
      try {
        if (conexionInicializada) {
          try {
            // Solo retiramos tareas generadas por esta prueba.
            await database.query(
              `
                DELETE FROM obra.archivos_pendientes_eliminacion
                WHERE s3_key = ANY($1::text[])
              `,
              [claves],
            );
          } finally {
            await database.onApplicationShutdown();
          }
        }
      } finally {
        if (raizAnterior === undefined) {
          delete process.env.STORAGE_LOCAL_ROOT;
        } else {
          process.env.STORAGE_LOCAL_ROOT = raizAnterior;
        }

        await rm(raizTemporal, {
          recursive: true,
          force: true,
        });
      }
    }
  },
);