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
 * Comprueba la recuperación sin conservar datos de prueba.
 *
 * Una conexión bloquea las notificaciones preexistentes para que
 * SKIP LOCKED las omita. La otra crea y comprueba sus propios datos
 * dentro de una transacción que siempre se revierte.
 *
 * No se utiliza SMTP.
 */
test('correo: cierra reservas vencidas por lotes y conserva las vigentes', async () => {
  const pool = new Pool({
    ...getDatabaseConfig(),
    max: 2,
    connectionTimeoutMillis: 5_000,
  });

  const repository = new NotificacionesCorreoRepository();

  const propietario = randomUUID();
  const receptor = randomUUID();
  const proyecto = randomUUID();

  const vencidas = [randomUUID(), randomUUID(), randomUUID()];
  const vigente = randomUUID();
  const sinReserva = randomUUID();

  const tokens = new Map(
    [...vencidas, vigente].map((id) => [id, randomUUID()]),
  );

  let aislamiento;
  let client;

  try {
    aislamiento = await pool.connect();
    await aislamiento.query('BEGIN');
    await aislamiento.query("SET LOCAL lock_timeout = '3s'");
    await aislamiento.query("SET LOCAL statement_timeout = '5s'");

    await aislamiento.query(`
      SELECT id_notificacion
      FROM obra.notificaciones
      FOR UPDATE
    `);

    client = await pool.connect();
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '5s'");

    for (const id of [propietario, receptor]) {
      await client.query(
        `
          INSERT INTO obra.usuarios (
            id_usuario, correo, google_sub
          )
          VALUES ($1, $2, $3)
        `,
        [
          id,
          `${id}@example.invalid`,
          `reservas-vencidas-${id}`,
        ],
      );
    }

    await client.query(
      `
        INSERT INTO obra.proyectos (
          id_proyecto, id_propietario, nombre,
          descripcion, direccion, contratante,
          fecha_inicio, estado_proyecto
        )
        VALUES (
          $1, $2, 'Proyecto temporal',
          'Recuperación de reservas',
          'Dirección temporal', 'Contratante temporal',
          CURRENT_DATE, 'ACTIVA'
        )
      `,
      [proyecto, propietario],
    );

    for (const id of [...vencidas, vigente, sinReserva]) {
      const tieneReserva = id !== sinReserva;
      const segundos = id === vigente ? 300 : -300;

      await client.query(
        `
          INSERT INTO obra.notificaciones (
            id_notificacion, id_receptor, id_actor,
            id_proyecto, tipo, titulo, mensaje,
            correo_intentos, correo_reserva,
            correo_reservado_hasta
          )
          VALUES (
            $1, $2, $3, $4,
            'INCIDENCIA_CREADA',
            'Incidencia creada',
            'Contenido que debe conservarse',
            $5,
            $6::uuid,
            CASE
              WHEN $6::uuid IS NULL THEN NULL
              ELSE clock_timestamp()
                + ($7::integer * INTERVAL '1 second')
            END
          )
        `,
        [
          id,
          receptor,
          propietario,
          proyecto,
          tieneReserva ? 2 : 0,
          tokens.get(id) ?? null,
          segundos,
        ],
      );
    }

    async function consultar() {
      const resultado = await client.query(
        `
          SELECT
            id_notificacion,
            estado_envio_correo,
            correo_intentos,
            correo_reserva,
            correo_reservado_hasta,
            titulo,
            mensaje
          FROM obra.notificaciones
          WHERE id_proyecto = $1
          ORDER BY id_notificacion
        `,
        [proyecto],
      );

      return resultado.rows;
    }

    const iniciales = await consultar();
    const inicialPorId = new Map(
      iniciales.map((fila) => [fila.id_notificacion, fila]),
    );

    // El primer lote debe cerrar exactamente una de las tres vencidas.
    assert.equal(
      await repository.cerrarReservasVencidas(client, 1),
      1,
    );

    const primerLote = await consultar();
    const cerradas = primerLote.filter(
      (fila) => fila.estado_envio_correo === 'FALLIDA',
    );

    assert.equal(cerradas.length, 1);
    assert.ok(vencidas.includes(cerradas[0].id_notificacion));

    // El siguiente lote cierra las dos restantes.
    assert.equal(
      await repository.cerrarReservasVencidas(client, 100),
      2,
    );

    // Repetir la recuperación no vuelve a afectar las filas finalizadas.
    assert.equal(
      await repository.cerrarReservasVencidas(client, 100),
      0,
    );

    const finales = await consultar();
    assert.equal(finales.length, 5);

    const finalPorId = new Map(
      finales.map((fila) => [fila.id_notificacion, fila]),
    );

    for (const id of vencidas) {
      assert.deepEqual(finalPorId.get(id), {
        ...inicialPorId.get(id),
        estado_envio_correo: 'FALLIDA',
        correo_reserva: null,
        correo_reservado_hasta: null,
      });

      // El intento anterior no puede confirmar un resultado después
      // de que la recuperación haya cerrado su reserva.
      assert.equal(
        await repository.marcarEnviada(client, id, tokens.get(id)),
        false,
      );
    }

    // La reserva vigente y la notificación sin reservar no cambian.
    assert.deepEqual(
      finalPorId.get(vigente),
      inicialPorId.get(vigente),
    );

    assert.deepEqual(
      finalPorId.get(sinReserva),
      inicialPorId.get(sinReserva),
    );
  } finally {
    /*
     * Revertimos ambas transacciones aunque una comprobación falle.
     * Cada conexión se libera incluso si falla su ROLLBACK.
     */
    const limpieza = await Promise.allSettled(
      [client, aislamiento]
        .filter(Boolean)
        .map(async (conexion) => {
          try {
            await conexion.query('ROLLBACK');
          } finally {
            conexion.release(true);
          }
        }),
    );

    await pool.end();

    const errores = limpieza
      .filter((resultado) => resultado.status === 'rejected')
      .map((resultado) => resultado.reason);

    if (errores.length > 0) {
      throw new AggregateError(
        errores,
        'No se pudo completar la limpieza de la prueba.',
      );
    }
  }
});