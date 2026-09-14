require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  ArchivosPendientesRepository,
} = require('../../dist/modules/almacenamiento/archivos-pendientes.repository');

test(
  'pendientes registrar: evita duplicados y revierte las tareas con la transacción',
  async () => {
    const database = new DatabaseService();
    const repositorio = new ArchivosPendientesRepository();

    const claves = [
      `fotografias/${randomUUID()}.jpeg`,
      `fotografias/${randomUUID()}.webp`,
    ];

    const finalizar = new Error('Revertir pendientes de la prueba');
    let conexionInicializada = false;

    try {
      await database.onModuleInit();
      conexionInicializada = true;

      await assert.rejects(
        () =>
          database.withTransaction(async (client) => {
            /*
             * Incluimos una repetición dentro del propio arreglo.
             * Deben crearse únicamente dos tareas.
             */
            await repositorio.registrar(client, [
              claves[0],
              claves[1],
              claves[0],
            ]);

            const consultar = () =>
              client.query(
                `
                  SELECT s3_key, fecha_creacion
                  FROM obra.archivos_pendientes_eliminacion
                  WHERE s3_key = ANY($1::text[])
                  ORDER BY s3_key
                `,
                [claves],
              );

            const primeraConsulta = await consultar();

            assert.equal(primeraConsulta.rowCount, 2);

            assert.deepEqual(
              primeraConsulta.rows.map((fila) => fila.s3_key),
              [...claves].sort(),
            );

            for (const fila of primeraConsulta.rows) {
              assert.ok(fila.fecha_creacion instanceof Date);
              assert.ok(
                Number.isFinite(fila.fecha_creacion.getTime()),
              );
            }

            /*
             * Fijamos una fecha anterior para comprobar realmente
             * que registrar otra vez no actualiza la tarea existente.
             *
             * CURRENT_TIMESTAMP es constante dentro de la transacción:
             * comparar dos inserciones sin este cambio no demostraría
             * que se conserva la fecha.
             */
            await client.query(
              `
                UPDATE obra.archivos_pendientes_eliminacion
                SET fecha_creacion = $2::timestamptz
                WHERE s3_key = ANY($1::text[])
              `,
              [claves, '2000-01-01T00:00:00.000Z'],
            );

            const antesDeRepetir = await consultar();

            await repositorio.registrar(client, claves);

            const despuesDeRepetir = await consultar();

            assert.equal(despuesDeRepetir.rowCount, 2);
            assert.deepEqual(
              despuesDeRepetir.rows,
              antesDeRepetir.rows,
            );

            // Fuerza la reversión real de toda la preparación.
            throw finalizar;
          }),
        (error) => {
          assert.strictEqual(error, finalizar);
          return true;
        },
      );

      /*
       * Consultamos fuera de la transacción revertida.
       * Ninguna de sus tareas debe permanecer en PostgreSQL.
       */
      const posteriores = await database.query(
        `
          SELECT s3_key
          FROM obra.archivos_pendientes_eliminacion
          WHERE s3_key = ANY($1::text[])
        `,
        [claves],
      );

      assert.equal(posteriores.rowCount, 0);
    } finally {
      if (conexionInicializada) {
        await database.onApplicationShutdown();
      }
    }
  },
);