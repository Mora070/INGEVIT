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

const {
  ArchivosPendientesService,
} = require('../../dist/modules/almacenamiento/archivos-pendientes.service');

test(
  'reintento: aplaza la tarea fallida y permite procesar otra disponible',
  async () => {
    const database = new DatabaseService();
    const pendientes = new ArchivosPendientesRepository();

    const claveFallida = `fotografias/${randomUUID()}.webp`;
    const claveDisponible = `fotografias/${randomUUID()}.jpeg`;
    const claves = [claveFallida, claveDisponible];

    const errorEsperado = new Error('Fallo simulado del almacenamiento');
    const intentos = [];

    let conexionInicializada = false;

    try {
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

      await database.withTransaction(async (client) => {
        await pendientes.registrar(client, claves);

        /*
         * Establecemos un orden inequívoco.
         * Ambas tareas están disponibles, pero la fallida va primero.
         */
        await client.query(
          `
            UPDATE obra.archivos_pendientes_eliminacion
            SET fecha_proximo_intento = CASE
              WHEN s3_key = $1 THEN '2000-01-01'::timestamptz
              ELSE '2000-01-02'::timestamptz
            END
            WHERE s3_key = ANY($2::text[])
          `,
          [claveFallida, claves],
        );
      });

      const servicio = new ArchivosPendientesService(
        database,
        pendientes,
        {
          async eliminar(clave) {
            intentos.push(clave);

            if (clave === claveFallida) {
              throw errorEsperado;
            }

            assert.equal(clave, claveDisponible);
          },
        },
      );

      /*
       * La operación falla, revierte su transacción y confirma
       * el aplazamiento en una transacción independiente.
       */
      await assert.rejects(
        () => servicio.procesarSiguienteConReintento(3600),
        (error) => {
          assert.strictEqual(error, errorEsperado);
          return true;
        },
      );

      const aplazada = await database.query(
        `
          SELECT
            s3_key,
            fecha_proximo_intento > statement_timestamp()
              AS esta_en_futuro
          FROM obra.archivos_pendientes_eliminacion
          WHERE s3_key = $1
        `,
        [claveFallida],
      );

      assert.deepEqual(aplazada.rows, [
        {
          s3_key: claveFallida,
          esta_en_futuro: true,
        },
      ]);

      // El siguiente intento debe seleccionar la otra tarea.
      assert.equal(
        await servicio.procesarSiguienteConReintento(3600),
        true,
      );

      assert.deepEqual(intentos, [
        claveFallida,
        claveDisponible,
      ]);

      const restantes = await database.query(
        `
          SELECT s3_key
          FROM obra.archivos_pendientes_eliminacion
          WHERE s3_key = ANY($1::text[])
        `,
        [claves],
      );

      assert.deepEqual(restantes.rows, [
        { s3_key: claveFallida },
      ]);

      /*
       * La cola no está vacía, pero la única tarea restante
       * todavía no está disponible.
       */
      assert.equal(
        await servicio.procesarSiguienteConReintento(3600),
        false,
      );

      assert.equal(intentos.length, 2);
    } finally {
      if (conexionInicializada) {
        try {
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
    }
  },
);