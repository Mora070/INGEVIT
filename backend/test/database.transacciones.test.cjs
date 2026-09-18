require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { Logger } = require('@nestjs/common');

const databaseConfig = require('../dist/database/database.config');

const {
  DatabaseService,
} = require('../dist/database/database.service');

const {
  ResultadoTransaccionDesconocidoError,
} = require(
  '../dist/database/errors/resultado-transaccion-desconocido.error',
);

/**
 * Sustituye la obtención de conexiones por un cliente simulado.
 *
 * No lee credenciales reales ni establece conexiones de red.
 * Los mocks del contexto t se restauran al terminar cada prueba.
 */
async function conDatabaseSimulada(
  t,
  operacion,
  {
    errorCommit,
    errorRollback,
    comandoCommit = 'COMMIT',
  } = {},
) {
  const consultas = [];
  const liberaciones = [];

  const client = {
    async query(sql) {
      consultas.push(sql);

      if (sql === 'BEGIN') {
        return { command: 'BEGIN', rows: [], rowCount: null };
      }

      if (sql === 'COMMIT') {
        if (errorCommit) {
          throw errorCommit;
        }

        return {
          command: comandoCommit,
          rows: [],
          rowCount: null,
        };
      }

      if (sql === 'ROLLBACK') {
        if (errorRollback) {
          throw errorRollback;
        }

        return {
          command: 'ROLLBACK',
          rows: [],
          rowCount: null,
        };
      }

      assert.fail(`Consulta inesperada en la prueba: ${sql}`);
    },

    release(descartar) {
      liberaciones.push(descartar);
    },
  };

  t.mock.method(
    databaseConfig,
    'getDatabaseConfig',
    () => ({
      host: '127.0.0.1',
      port: 5432,
      database: 'prueba_sin_conexion',
      user: 'prueba_sin_conexion',
    }),
  );

  t.mock.method(Pool.prototype, 'connect', async () => client);

  // Los errores de estos escenarios son intencionales.
  t.mock.method(Logger.prototype, 'error', () => {});
  t.mock.method(Logger.prototype, 'log', () => {});

  const database = new DatabaseService();

  try {
    await operacion({
      database,
      client,
      consultas,
      liberaciones,
    });
  } finally {
    await database.onApplicationShutdown();
  }
}

test(
  'withTransaction: devuelve el resultado después de confirmar y libera la conexión',
  async (t) => {
    await conDatabaseSimulada(
      t,
      async ({ database, client, consultas, liberaciones }) => {
        const esperado = { completado: true };

        const resultado = await database.withTransaction(
          async (clienteRecibido) => {
            assert.strictEqual(clienteRecibido, client);
            return esperado;
          },
        );

        assert.strictEqual(resultado, esperado);
        assert.deepEqual(consultas, ['BEGIN', 'COMMIT']);
        assert.deepEqual(liberaciones, [false]);
      },
    );
  },
);

test(
  'withTransaction: conserva el error original cuando confirma la reversión',
  async (t) => {
    await conDatabaseSimulada(
      t,
      async ({ database, consultas, liberaciones }) => {
        const errorOriginal = new Error('Falló la operación.');

        await assert.rejects(
          database.withTransaction(async () => {
            throw errorOriginal;
          }),
          (error) => error === errorOriginal,
        );

        assert.deepEqual(consultas, ['BEGIN', 'ROLLBACK']);
        assert.deepEqual(liberaciones, [false]);
      },
    );
  },
);

test(
  'withTransaction: informa COMMIT incierto y descarta la conexión sin ejecutar ROLLBACK',
  async (t) => {
    const errorCommit = new Error(
      'Conexión perdida durante la confirmación.',
    );

    await conDatabaseSimulada(
      t,
      async ({ database, consultas, liberaciones }) => {
        await assert.rejects(
          database.withTransaction(async () => 'resultado'),
          (error) => {
            assert.ok(
              error instanceof ResultadoTransaccionDesconocidoError,
            );
            assert.equal(error.etapa, 'COMMIT');
            assert.strictEqual(error.cause, errorCommit);
            assert.equal(error.errorReversion, undefined);

            return true;
          },
        );

        assert.deepEqual(consultas, ['BEGIN', 'COMMIT']);
        assert.deepEqual(liberaciones, [true]);
      },
      { errorCommit },
    );
  },
);

test(
  'withTransaction: conserva ambas causas cuando falla ROLLBACK',
  async (t) => {
    const errorOriginal = new Error('Falló la operación.');
    const errorRollback = new Error('Falló la reversión.');

    await conDatabaseSimulada(
      t,
      async ({ database, consultas, liberaciones }) => {
        await assert.rejects(
          database.withTransaction(async () => {
            throw errorOriginal;
          }),
          (error) => {
            assert.ok(
              error instanceof ResultadoTransaccionDesconocidoError,
            );
            assert.equal(error.etapa, 'ROLLBACK');
            assert.strictEqual(error.cause, errorOriginal);
            assert.strictEqual(
              error.errorReversion,
              errorRollback,
            );

            return true;
          },
        );

        assert.deepEqual(consultas, ['BEGIN', 'ROLLBACK']);
        assert.deepEqual(liberaciones, [true]);
      },
      { errorRollback },
    );
  },
);

test(
  'withTransaction: no comunica éxito si COMMIT responde con ROLLBACK',
  async (t) => {
    await conDatabaseSimulada(
      t,
      async ({ database, consultas, liberaciones }) => {
        await assert.rejects(
          database.withTransaction(async () => 'resultado'),
          (error) => {
            assert.ok(
              error instanceof ResultadoTransaccionDesconocidoError,
            );
            assert.equal(error.etapa, 'COMMIT');
            assert.equal(
              error.cause.message,
              'PostgreSQL no confirmó la transacción con una respuesta COMMIT.',
            );

            return true;
          },
        );

        assert.deepEqual(consultas, ['BEGIN', 'COMMIT']);
        assert.deepEqual(liberaciones, [true]);
      },
      { comandoCommit: 'ROLLBACK' },
    );
  },
);