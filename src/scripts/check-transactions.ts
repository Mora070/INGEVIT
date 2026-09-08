import 'reflect-metadata';
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import type { QueryResultRow } from 'pg';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';

/**
 * Representa el resultado de las consultas de comprobación.
 *
 * El identificador de sesión permite verificar que seguimos
 * trabajando con la conexión que contiene la tabla temporal.
 */
interface CheckRow extends QueryResultRow {
  session_id: number;
  value: number;
}

/**
 * Comprueba las transacciones sin modificar tablas de negocio.
 *
 * Este proceso ejecuta consultas secuencialmente y sin otros
 * consumidores del pool. Aun así, comprueba la identidad de la
 * sesión: las tablas temporales pertenecen a una conexión concreta.
 */
async function checkTransactions(): Promise<void> {
  // Inicia únicamente el módulo de base de datos, sin servidor HTTP.
  const context = await NestFactory.createApplicationContext(
    DatabaseModule,
    {
      logger: ['warn', 'error'],
      abortOnError: false,
    },
  );

  try {
    const database = context.get(DatabaseService);

    /*
     * Prueba 1: crear la tabla temporal e insertar un valor.
     * PRESERVE ROWS conserva sus filas después del COMMIT,
     * pero la tabla desaparece cuando se cierra la conexión.
     */
    const sessionId = await database.withTransaction(async (client) => {
      await client.query(`
        CREATE TEMP TABLE transaction_check (
          value integer NOT NULL
        ) ON COMMIT PRESERVE ROWS
      `);

      await client.query(
        'INSERT INTO transaction_check (value) VALUES ($1)',
        [10],
      );

      const result = await client.query<CheckRow>(`
        SELECT pg_backend_pid() AS session_id, value
        FROM pg_temp.transaction_check
      `);

      return result.rows[0].session_id;
    });

    // Se consulta después de que withTransaction haya confirmado.
    const committed = await database.query<CheckRow>(`
      SELECT pg_backend_pid() AS session_id, value
      FROM pg_temp.transaction_check
    `);

    assert.equal(
      committed.rows[0].session_id,
      sessionId,
      'La prueba necesita conservar la misma sesión temporal.',
    );

    assert.equal(committed.rows.length, 1);
    assert.equal(committed.rows[0].value, 10);

    console.log('OK: COMMIT conserva el valor insertado.');

    /*
     * Prueba 2: modificar el valor y provocar un error.
     * El valor 20 no debe permanecer después del ROLLBACK.
     */
    const expectedError = new Error('Fallo intencional de la prueba');

    await assert.rejects(
      () =>
        database.withTransaction(async (client) => {
          const session = await client.query<CheckRow>(`
            SELECT pg_backend_pid() AS session_id
          `);

          assert.equal(session.rows[0].session_id, sessionId);

          await client.query(
            'UPDATE pg_temp.transaction_check SET value = $1',
            [20],
          );

          throw expectedError;
        }),
      (error: unknown) => error === expectedError,
    );

    console.log('OK: se conserva y propaga el error original.');

    const rolledBack = await database.query<CheckRow>(`
      SELECT pg_backend_pid() AS session_id, value
      FROM pg_temp.transaction_check
    `);

    assert.equal(rolledBack.rows[0].session_id, sessionId);
    assert.equal(rolledBack.rows.length, 1);
    assert.equal(rolledBack.rows[0].value, 10);

    console.log('OK: ROLLBACK deshace la modificación.');
    console.log('Comprobación de transacciones completada.');
  } finally {
    // Ejecuta el cierre del servicio y elimina la sesión temporal.
    await context.close();
  }
}

checkTransactions().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'Falló la comprobación de transacciones.',
  );

  process.exitCode = 1;
});