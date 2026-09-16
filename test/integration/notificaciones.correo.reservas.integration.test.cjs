require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

const {
  getDatabaseConfig,
} = require('../../dist/database/database.config');

const {
  NotificacionesCorreoRepository,
} = require(
  '../../dist/modules/notificaciones/correos/notificaciones-correo.repository'
);

/**
 * Comprueba reservas y actualizaciones con conexiones independientes.
 *
 * Los datos propios se confirman para que ambas conexiones puedan verlos.
 * Al finalizar se eliminan exclusivamente el proyecto y usuarios creados.
 *
 * Una tercera conexión bloquea las notificaciones preexistentes:
 * SKIP LOCKED las omite sin modificar su contenido ni estado.
 *
 * No se construye CorreoService ni se contacta con SMTP.
 */
test('correo: reserva concurrentemente y protege los resultados por token y vencimiento', async () => {
  const pool = new Pool({
    ...getDatabaseConfig(),
    max: 4,
    connectionTimeoutMillis: 5_000,
  });

  const repository = new NotificacionesCorreoRepository();

  const propietario = randomUUID();
  const receptor = randomUUID();
  const proyecto = randomUUID();
  const ids = [randomUUID(), randomUUID()];

  let aislamiento;
  let primero;
  let segundo;

  try {
    aislamiento = await pool.connect();

    await aislamiento.query('BEGIN');
    await aislamiento.query("SET LOCAL lock_timeout = '3s'");
    await aislamiento.query("SET LOCAL statement_timeout = '5s'");

    // No cambia filas ajenas. Solo impide seleccionarlas desde los
    // otros clientes mientras dure esta prueba.
    await aislamiento.query(`
      SELECT id_notificacion
      FROM obra.notificaciones
      FOR UPDATE
    `);

    primero = await pool.connect();
    segundo = await pool.connect();

    // Evita que un defecto en SKIP LOCKED deje la prueba esperando.
    for (const client of [primero, segundo]) {
      await client.query("SET statement_timeout = '5s'");
      await client.query("SET lock_timeout = '3s'");
    }

    await primero.query('BEGIN');

    for (const id of [propietario, receptor]) {
      await primero.query(
        `
          INSERT INTO obra.usuarios (
            id_usuario, correo, google_sub
          )
          VALUES ($1, $2, $3)
        `,
        [
          id,
          `${id}@example.invalid`,
          `correo-reservas-${id}`,
        ],
      );
    }

    await primero.query(
      `
        INSERT INTO obra.proyectos (
          id_proyecto,
          id_propietario,
          nombre,
          descripcion,
          direccion,
          contratante,
          fecha_inicio,
          estado_proyecto
        )
        VALUES (
          $1, $2,
          'Proyecto de prueba de correo',
          'Reservas concurrentes',
          'Dirección temporal',
          'Contratante temporal',
          CURRENT_DATE,
          'ACTIVA'
        )
      `,
      [proyecto, propietario],
    );

    for (const id of ids) {
      /*
       * Insertamos directamente porque esta prueba verifica la cola,
       * no el trigger de creación de incidencias.
       *
       * id_incidencia admite null.
       */
      await primero.query(
        `
          INSERT INTO obra.notificaciones (
            id_notificacion,
            id_receptor,
            id_actor,
            id_proyecto,
            tipo,
            titulo,
            mensaje
          )
          VALUES (
            $1, $2, $3, $4,
            'INCIDENCIA_CREADA',
            'Incidencia creada',
            'Comprobación de reservas'
          )
        `,
        [id, receptor, propietario, proyecto],
      );
    }

    await primero.query('COMMIT');

    // Ambos clientes pueden ver ahora las notificaciones de prueba.
    await primero.query('BEGIN');
    await segundo.query('BEGIN');

    const reservaA = await repository.reservarSiguiente(
      primero,
      120,
      5,
    );

    assert.ok(reservaA);
    assert.ok(ids.includes(reservaA.id_notificacion));

    /*
     * La primera transacción sigue abierta y mantiene su bloqueo.
     * La segunda debe encontrar la otra notificación sin esperar.
     */
    const reservaB = await repository.reservarSiguiente(
      segundo,
      120,
      5,
    );

    assert.ok(reservaB);
    assert.ok(ids.includes(reservaB.id_notificacion));
    assert.notEqual(
      reservaA.id_notificacion,
      reservaB.id_notificacion,
    );
    assert.notEqual(
      reservaA.correo_reserva,
      reservaB.correo_reserva,
    );
    assert.equal(reservaA.correo_intentos, 1);
    assert.equal(reservaB.correo_intentos, 1);

    await primero.query('COMMIT');
    await segundo.query('COMMIT');

    await primero.query('BEGIN');

    // Las dos filas ya están reservadas.
    assert.equal(
      await repository.reservarSiguiente(primero, 120, 5),
      null,
    );

    // Un identificador de reserva ajeno no permite finalizar.
    assert.equal(
      await repository.marcarEnviada(
        primero,
        reservaA.id_notificacion,
        randomUUID(),
      ),
      false,
    );

    assert.equal(
      await repository.marcarFallida(
        primero,
        reservaA.id_notificacion,
        randomUUID(),
      ),
      false,
    );

    // La reserva correcta sí permite registrar el resultado.
    assert.equal(
      await repository.marcarEnviada(
        primero,
        reservaA.id_notificacion,
        reservaA.correo_reserva,
      ),
      true,
    );

    // Una reserva consumida no puede cambiar ENVIADA por FALLIDA.
    assert.equal(
      await repository.marcarFallida(
        primero,
        reservaA.id_notificacion,
        reservaA.correo_reserva,
      ),
      false,
    );

    const enviada = await primero.query(
      `
        SELECT
          estado_envio_correo,
          correo_reserva,
          correo_reservado_hasta,
          correo_intentos
        FROM obra.notificaciones
        WHERE id_notificacion = $1
      `,
      [reservaA.id_notificacion],
    );

    assert.deepEqual(enviada.rows[0], {
      estado_envio_correo: 'ENVIADA',
      correo_reserva: null,
      correo_reservado_hasta: null,
      correo_intentos: 1,
    });

    // Simulamos el vencimiento sin introducir esperas en la prueba.
    await primero.query(
      `
        UPDATE obra.notificaciones
        SET correo_reservado_hasta =
          clock_timestamp() - INTERVAL '1 second'
        WHERE id_notificacion = $1
      `,
      [reservaB.id_notificacion],
    );

    for (const metodo of ['marcarEnviada', 'marcarFallida']) {
      assert.equal(
        await repository[metodo](
          primero,
          reservaB.id_notificacion,
          reservaB.correo_reserva,
        ),
        false,
      );
    }

    // Una reserva vencida tampoco se vuelve a seleccionar.
    assert.equal(
      await repository.reservarSiguiente(primero, 120, 5),
      null,
    );

    // Restablecemos la vigencia solo en este dato de prueba
    // para verificar también la finalización FALLIDA.
    await primero.query(
      `
        UPDATE obra.notificaciones
        SET correo_reservado_hasta =
          clock_timestamp() + INTERVAL '2 minutes'
        WHERE id_notificacion = $1
      `,
      [reservaB.id_notificacion],
    );

    assert.equal(
      await repository.marcarFallida(
        primero,
        reservaB.id_notificacion,
        reservaB.correo_reserva,
      ),
      true,
    );

    const fallida = await primero.query(
      `
        SELECT
          estado_envio_correo,
          correo_reserva,
          correo_reservado_hasta
        FROM obra.notificaciones
        WHERE id_notificacion = $1
      `,
      [reservaB.id_notificacion],
    );

    assert.deepEqual(fallida.rows[0], {
      estado_envio_correo: 'FALLIDA',
      correo_reserva: null,
      correo_reservado_hasta: null,
    });

    await primero.query('COMMIT');
  } finally {
    /*
     * Primero revertimos cualquier transacción que siga abierta.
     * Destruimos estas conexiones para no conservar ajustes de sesión.
     */
    for (const client of [primero, segundo, aislamiento]) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } finally {
          client.release(true);
        }
      }
    }

    try {
      // El proyecto elimina sus notificaciones mediante ON DELETE CASCADE.
      await pool.query(
        'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
        [proyecto],
      );

      await pool.query(
        'DELETE FROM obra.usuarios WHERE id_usuario = ANY($1::uuid[])',
        [[propietario, receptor]],
      );
    } finally {
      await pool.end();
    }
  }
});