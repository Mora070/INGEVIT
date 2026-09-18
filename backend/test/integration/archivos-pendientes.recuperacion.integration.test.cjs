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
  'pendientes: recupera una tarea después de borrar el archivo y revertir su finalización',
  async () => {
    const raizTemporal = await mkdtemp(
      path.join(tmpdir(), 'ingevit-recuperacion-'),
    );

    const raizAnterior = process.env.STORAGE_LOCAL_ROOT;
    const clave = `fotografias/${randomUUID()}.webp`;

    let database;
    let conexionInicializada = false;

    try {
      process.env.STORAGE_LOCAL_ROOT = raizTemporal;

      database = new DatabaseService();
      await database.onModuleInit();
      conexionInicializada = true;

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
      const ruta = path.join(raizTemporal, ...clave.split('/'));

      const contenido = Buffer.from('Archivo temporal para recuperación');
      const entrada = Readable.from([contenido]);

      try {
        await almacenamiento.guardar(clave, entrada);
      } finally {
        entrada.destroy();
      }

      assert.deepEqual(await readFile(ruta), contenido);

      await database.withTransaction((client) =>
        pendientes.registrar(client, [clave]),
      );

      let finalizacionIntentada = false;

      /*
       * Conservamos las consultas reales.
       * Solo introducimos un fallo después de retirar la tarea,
       * pero antes de que la transacción pueda confirmarse.
       */
      const pendientesConFallo = {
        bloquearSiguiente: (client) =>
          pendientes.bloquearSiguiente(client),

        estaReferenciadoEnFotografias: (client, claveArchivo) =>
          pendientes.estaReferenciadoEnFotografias(
            client,
            claveArchivo,
          ),

        async completar(client, claveArchivo) {
          await pendientes.completar(client, claveArchivo);
          finalizacionIntentada = true;

          // Error SQL deliberado: s3_key no admite NULL.
          await client.query(
            `
              INSERT INTO obra.archivos_pendientes_eliminacion
                (s3_key)
              VALUES (NULL)
            `,
          );
        },
      };

      const servicioConFallo = new ArchivosPendientesService(
        database,
        pendientesConFallo,
        almacenamiento,
      );

      await assert.rejects(
        () => servicioConFallo.procesarSiguiente(),
        (error) => {
          assert.equal(error.code, '23502');
          return true;
        },
      );

      assert.equal(finalizacionIntentada, true);

      // El borrado físico no se revierte con PostgreSQL.
      await assert.rejects(
        () => readFile(ruta),
        { code: 'ENOENT' },
      );

      // El ROLLBACK sí restaura la tarea pendiente.
      const pendienteTrasFallo = await database.query(
        `
          SELECT s3_key
          FROM obra.archivos_pendientes_eliminacion
          WHERE s3_key = $1
        `,
        [clave],
      );

      assert.deepEqual(pendienteTrasFallo.rows, [
        { s3_key: clave },
      ]);

      // Segundo intento, sin el fallo deliberado.
      const servicio = new ArchivosPendientesService(
        database,
        pendientes,
        almacenamiento,
      );

      assert.equal(await servicio.procesarSiguiente(), true);

      const despuesDelReintento = await database.query(
        `
          SELECT s3_key
          FROM obra.archivos_pendientes_eliminacion
          WHERE s3_key = $1
        `,
        [clave],
      );

      assert.equal(despuesDelReintento.rowCount, 0);
    } finally {
      try {
        if (conexionInicializada) {
          try {
            await database.query(
              `
                DELETE FROM obra.archivos_pendientes_eliminacion
                WHERE s3_key = $1
              `,
              [clave],
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