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
  'aplazar: excluye tareas futuras y conserva una fecha posterior ya programada',
  async () => {
    const database = new DatabaseService();
    const repositorio = new ArchivosPendientesRepository();

    const clave = `fotografias/${randomUUID()}.webp`;
    const finalizar = new Error('Revertir tarea temporal');

    let conexionInicializada = false;

    try {
      await database.onModuleInit();
      conexionInicializada = true;

      await assert.rejects(
        () =>
          database.withTransaction(async (client) => {
            /*
             * bloquearSiguiente consulta la cola completa.
             * La prueba requiere que no haya tareas ajenas.
             */
            const existentes = await client.query(
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
              'Esta prueba requiere una cola vacía.',
            );

            await repositorio.registrar(client, [clave]);

            const consultar = async () => {
              const resultado = await client.query(
                `
                  SELECT
                    s3_key,
                    fecha_creacion,
                    fecha_proximo_intento,
                    fecha_proximo_intento > statement_timestamp()
                      AS esta_en_futuro
                  FROM obra.archivos_pendientes_eliminacion
                  WHERE s3_key = $1
                `,
                [clave],
              );

              assert.equal(resultado.rowCount, 1);
              return resultado.rows[0];
            };

            const inicial = await consultar();

            // Una tarea recién creada está disponible.
            const disponible = await repositorio.bloquearSiguiente(client);

            assert.ok(disponible);
            assert.equal(disponible.s3_key, clave);

            // Después de aplazarla, queda fuera de la selección.
            assert.equal(
              await repositorio.aplazar(client, clave, 3600),
              true,
            );

            const aplazada = await consultar();

            assert.equal(aplazada.esta_en_futuro, true);
            assert.deepEqual(
              aplazada.fecha_creacion,
              inicial.fecha_creacion,
            );

            assert.equal(
              await repositorio.bloquearSiguiente(client),
              null,
            );

            /*
             * Fijamos una fecha claramente posterior al próximo intento
             * solicitado para comprobar el comportamiento de GREATEST.
             */
            await client.query(
              `
                UPDATE obra.archivos_pendientes_eliminacion
                SET fecha_proximo_intento =
                  statement_timestamp() + INTERVAL '30 days'
                WHERE s3_key = $1
              `,
              [clave],
            );

            const programada = await consultar();

            await repositorio.aplazar(client, clave, 60);

            const despuesDeAplazar = await consultar();

            assert.deepEqual(
              despuesDeAplazar.fecha_proximo_intento,
              programada.fecha_proximo_intento,
            );
            assert.deepEqual(
              despuesDeAplazar.fecha_creacion,
              inicial.fecha_creacion,
            );

            /*
             * Simulamos que llegó el momento del reintento.
             * No usamos pausas ni dependemos del reloj de Node.
             */
            await client.query(
              `
                UPDATE obra.archivos_pendientes_eliminacion
                SET fecha_proximo_intento =
                  statement_timestamp() - INTERVAL '1 second'
                WHERE s3_key = $1
              `,
              [clave],
            );

            const recuperada = await repositorio.bloquearSiguiente(client);

            assert.ok(recuperada);
            assert.equal(recuperada.s3_key, clave);

            // Una tarea inexistente no se crea al intentar aplazarla.
            assert.equal(
              await repositorio.aplazar(
                client,
                `fotografias/${randomUUID()}.webp`,
                60,
              ),
              false,
            );

            throw finalizar;
          }),
        (error) => {
          assert.strictEqual(error, finalizar);
          return true;
        },
      );

      const restantes = await database.query(
        `
          SELECT s3_key
          FROM obra.archivos_pendientes_eliminacion
          WHERE s3_key = $1
        `,
        [clave],
      );

      assert.equal(restantes.rowCount, 0);
    } finally {
      if (conexionInicializada) {
        await database.onApplicationShutdown();
      }
    }
  },
);