require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const { Readable } = require('node:stream');
const { performance } = require('node:perf_hooks');
const path = require('node:path');
const { Pool } = require('pg');

const {
  conAplicacionReal,
} = require('../helpers/con-aplicacion-real.cjs');

const {
  getDatabaseConfig,
} = require('../../dist/database/database.config');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  AlmacenamientoService,
} = require('../../dist/modules/almacenamiento/almacenamiento.service');

const {
  ArchivosPendientesRepository,
} = require('../../dist/modules/almacenamiento/archivos-pendientes.repository');

test(
  'worker real: procesa automáticamente una tarea y elimina su archivo',
  async () => {
    /*
     * Esta conexión permite comprobar la cola antes de arrancar
     * el trabajador y limpiar después de cerrar la aplicación.
     */
    const pool = new Pool(getDatabaseConfig());

    pool.on('error', () => {
      process.exitCode = 1;
    });

    const clave = `fotografias/${randomUUID()}.webp`;

    try {
      const existentes = await pool.query(
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
        'La prueba requiere una cola vacía antes de iniciar el trabajador.',
      );

      await conAplicacionReal(
        async ({ app, raizTemporal }) => {
          const database = app.get(DatabaseService);
          const almacenamiento = app.get(AlmacenamientoService);
          const pendientes = app.get(ArchivosPendientesRepository);

          const contenido = Buffer.from(
            'Archivo temporal para comprobar el trabajador automático',
          );

          const entrada = Readable.from([contenido]);

          try {
            await almacenamiento.guardar(clave, entrada);
          } finally {
            entrada.destroy();
          }

          const ruta = path.join(
            raizTemporal,
            ...clave.split('/'),
          );

          assert.deepEqual(await readFile(ruta), contenido);

          /*
           * El trabajador solo podrá ver la tarea después de confirmar
           * esta transacción.
           */
          await database.withTransaction((client) =>
            pendientes.registrar(client, [clave]),
          );

          /*
           * Esperamos una condición observable, no un tiempo fijo.
           * El límite detecta que el trabajador no esté funcionando.
           *
           * No invocamos procesarSiguiente ni métodos del worker.
           */
          const limite = performance.now() + 10_000;

          while (true) {
            const resultado = await database.query(
              `
                SELECT s3_key
                FROM obra.archivos_pendientes_eliminacion
                WHERE s3_key = $1
              `,
              [clave],
            );

            if (resultado.rowCount === 0) {
              break;
            }

            assert.ok(
              performance.now() < limite,
              'El trabajador no completó la tarea dentro de 10 segundos.',
            );

            await new Promise((resolve) => setTimeout(resolve, 50));
          }

          // Completar la tarea exige haber eliminado primero el archivo.
          await assert.rejects(
            () => readFile(ruta),
            { code: 'ENOENT' },
          );
        },
        { habilitarTrabajador: true },
      );

      /*
       * conAplicacionReal ya cerró Nest y ejecutó el apagado del worker.
       * Comprobamos que la retirada de la tarea quedó confirmada.
       */
      const restantes = await pool.query(
        `
          SELECT s3_key
          FROM obra.archivos_pendientes_eliminacion
          WHERE s3_key = $1
        `,
        [clave],
      );

      assert.equal(restantes.rowCount, 0);
    } finally {
      try {
        // Solo retiramos la clave exclusiva de esta prueba.
        await pool.query(
          `
            DELETE FROM obra.archivos_pendientes_eliminacion
            WHERE s3_key = $1
          `,
          [clave],
        );
      } finally {
        await pool.end();
      }
    }
  },
);