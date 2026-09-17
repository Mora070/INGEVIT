require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

const {
  getDatabaseConfig,
} = require('../../dist/database/database.config');

const {
  RecuperacionColaRepository,
} = require('../../dist/modules/auth/recuperacion-cola.repository');

/**
 * Comprueba la cola usando conexiones independientes.
 *
 * Bloquea las filas preexistentes para que SKIP LOCKED las omita.
 * Solo modifica y elimina solicitudes creadas por esta prueba.
 *
 * Ejecutar con el backend habitual detenido para evitar otros
 * productores o trabajadores durante la comprobación.
 */
test('recuperación cola: agrupa duplicados, reserva una sola vez y limpia tareas vencidas', async () => {
  const pool = new Pool({
    ...getDatabaseConfig(),
    max: 4,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
    lock_timeout: 5000,
  });

  const repository = new RecuperacionColaRepository({
    query: (sql, valores) => pool.query(sql, valores),
  });

  const correos = Array.from(
    { length: 4 },
    () => `${randomUUID()}@example.invalid`,
  );

  let proteccion;

  try {
    proteccion = await pool.connect();
    await proteccion.query('BEGIN');

    // Los métodos reservar y limpiarVencidas omitirán estas filas.
    await proteccion.query(
      'SELECT id_solicitud FROM obra.recuperacion_cola FOR UPDATE',
    );

    await repository.encolar(correos[0]);
    await repository.encolar(correos[0].toUpperCase());

    const duplicados = await pool.query(
      `
        SELECT id_solicitud
        FROM obra.recuperacion_cola
        WHERE lower(correo) = lower($1)
      `,
      [correos[0]],
    );

    assert.equal(duplicados.rowCount, 1);

    await repository.encolar(correos[1]);

    // Dos reservas concurrentes deben obtener tareas diferentes.
    const resultados = await Promise.allSettled([
      repository.reservar(),
      repository.reservar(),
    ]);

    const reservas = [];

    for (const resultado of resultados) {
      if (resultado.status === 'rejected') throw resultado.reason;

      assert.ok(resultado.value);
      reservas.push(resultado.value);
    }

    assert.notEqual(
      reservas[0].id_solicitud,
      reservas[1].id_solicitud,
    );

    assert.deepEqual(
      reservas.map((fila) => fila.correo).sort(),
      correos.slice(0, 2).sort(),
    );

    // Una tarea reservada no vuelve a seleccionarse.
    assert.equal(await repository.reservar(), null);

    // Repetir la solicitud tampoco reemplaza una reserva existente.
    await repository.encolar(reservas[0].correo);

    const mismaReserva = await pool.query(
      `
        SELECT id_solicitud, fecha_reserva
        FROM obra.recuperacion_cola
        WHERE correo = $1
      `,
      [reservas[0].correo],
    );

    assert.equal(
      mismaReserva.rows[0].id_solicitud,
      reservas[0].id_solicitud,
    );
    assert.ok(mismaReserva.rows[0].fecha_reserva);

    await repository.completar(reservas[0].id_solicitud);

    const completada = await pool.query(
      `
        SELECT id_solicitud
        FROM obra.recuperacion_cola
        WHERE id_solicitud = $1
      `,
      [reservas[0].id_solicitud],
    );

    assert.equal(completada.rowCount, 0);

    // Simula una reserva abandonada.
    await pool.query(
      `
        UPDATE obra.recuperacion_cola
        SET fecha_creacion = clock_timestamp() - interval '20 minutes',
            fecha_reserva = clock_timestamp() - interval '16 minutes'
        WHERE id_solicitud = $1
      `,
      [reservas[1].id_solicitud],
    );

    // Añade una pendiente vencida y otra reciente.
    await repository.encolar(correos[2]);
    await repository.encolar(correos[3]);

    await pool.query(
      `
        UPDATE obra.recuperacion_cola
        SET fecha_creacion = clock_timestamp() - interval '16 minutes'
        WHERE correo = $1
      `,
      [correos[2]],
    );

    assert.equal(await repository.limpiarVencidas(), 2);

    const restantes = await pool.query(
      `
        SELECT correo
        FROM obra.recuperacion_cola
        WHERE lower(correo) = ANY($1::text[])
      `,
      [correos],
    );

    assert.deepEqual(restantes.rows, [{ correo: correos[3] }]);

    const reciente = await repository.reservar();
    assert.ok(reciente);
    assert.equal(reciente.correo, correos[3]);

    await repository.completar(reciente.id_solicitud);
    assert.equal(await repository.reservar(), null);
  } finally {
    try {
      await pool.query(
        `
          DELETE FROM obra.recuperacion_cola
          WHERE lower(correo) = ANY($1::text[])
        `,
        [correos],
      );
    } finally {
      try {
        if (proteccion) {
          try {
            await proteccion.query('ROLLBACK');
          } finally {
            proteccion.release();
          }
        }
      } finally {
        await pool.end();
      }
    }
  }
});