require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  getDatabaseConfig,
} = require('../../dist/database/database.config');

const {
  NotificacionesCorreoRepository,
} = require(
  '../../dist/modules/notificaciones/correos/notificaciones-correo.repository'
);

const {
  NotificacionesCorreoService,
} = require(
  '../../dist/modules/notificaciones/correos/notificaciones-correo.service'
);

/**
 * Ejecuta el coordinador con transacciones y repositorio reales.
 *
 * Solo se simula SMTP. Las notificaciones preexistentes quedan
 * bloqueadas temporalmente para que SKIP LOCKED las omita.
 *
 * La limpieza elimina exclusivamente los datos de esta prueba.
 */
test('correo: coordina envío, fallo SMTP y pérdida de acceso con PostgreSQL real', async () => {
  const database = new DatabaseService();

  const poolAislamiento = new Pool({
    ...getDatabaseConfig(),
    max: 1,
    connectionTimeoutMillis: 5_000,
  });

  const propietario = randomUUID();
  const colaborador = randomUUID();
  const proyecto = randomUUID();
  const ids = [randomUUID(), randomUUID(), randomUUID()];

  const mensajes = [];
  let fallarEnvio = false;
  let aislamiento;

  const correoSimulado = {
    async enviar(mensaje) {
      mensajes.push(mensaje);

      /*
       * Esta consulta utiliza otra conexión.
       * Comprueba que la reserva ya se confirmó antes de enviar.
       */
      const resultado = await database.query(
        `
          SELECT id_notificacion
          FROM obra.notificaciones
          WHERE id_proyecto = $1
            AND correo_reserva IS NOT NULL
            AND correo_intentos = 1
        `,
        [proyecto],
      );

      assert.equal(resultado.rows.length, 1);

      if (fallarEnvio) {
        throw new Error('Error SMTP simulado');
      }

      return { messageId: '<integracion@ingevit.test>' };
    },
  };

  const servicio = new NotificacionesCorreoService(
    database,
    new NotificacionesCorreoRepository(),
    correoSimulado,
  );

  try {
    await database.onModuleInit();

    aislamiento = await poolAislamiento.connect();
    await aislamiento.query('BEGIN');
    await aislamiento.query("SET LOCAL lock_timeout = '3s'");
    await aislamiento.query("SET LOCAL statement_timeout = '5s'");

    await aislamiento.query(`
      SELECT id_notificacion
      FROM obra.notificaciones
      FOR UPDATE
    `);

    // Confirmamos los datos para que el coordinador pueda consultarlos
    // desde sus propias transacciones.
    await database.withTransaction(async (client) => {
      for (const id of [propietario, colaborador]) {
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
            `correo-procesamiento-${id}`,
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
            'Procesamiento de correo',
            'Dirección temporal',
            'Contratante temporal',
            CURRENT_DATE, 'ACTIVA'
          )
        `,
        [proyecto, propietario],
      );

      await client.query(
        `
          INSERT INTO obra.usuario_proyecto (
            id_usuario, id_proyecto
          )
          VALUES ($1, $2)
        `,
        [colaborador, proyecto],
      );

      for (const [indice, id] of ids.entries()) {
        /*
         * Fechas vencidas y diferentes para obtener un orden
         * determinista sin esperar entre inserciones.
         */
        await client.query(
          `
            INSERT INTO obra.notificaciones (
              id_notificacion, id_receptor, id_actor,
              id_proyecto, tipo, titulo, mensaje,
              correo_proximo_intento
            )
            VALUES (
              $1, $2, $3, $4,
              'INCIDENCIA_CREADA',
              'Incidencia creada',
              $5,
              CURRENT_TIMESTAMP - INTERVAL '1 day'
                + ($6::integer * INTERVAL '1 second')
            )
          `,
          [
            id,
            colaborador,
            propietario,
            proyecto,
            `Mensaje de prueba ${indice + 1}`,
            indice,
          ],
        );
      }
    });

    // 1. SMTP acepta el mensaje.
    assert.equal(await servicio.procesarSiguiente(), 'ENVIADA');
    assert.equal(mensajes.length, 1);
    assert.equal(
      mensajes[0].destinatario,
      `${colaborador}@example.invalid`,
    );
    assert.ok(mensajes[0].texto.includes(ids[0]));

    // 2. SMTP falla. No se repite el envío.
    fallarEnvio = true;

    assert.equal(await servicio.procesarSiguiente(), 'FALLIDA');
    assert.equal(mensajes.length, 2);
    assert.ok(mensajes[1].texto.includes(ids[1]));

    // 3. El destinatario pierde acceso antes de procesar la tercera.
    await database.query(
      `
        DELETE FROM obra.usuario_proyecto
        WHERE id_usuario = $1 AND id_proyecto = $2
      `,
      [colaborador, proyecto],
    );

    assert.equal(await servicio.procesarSiguiente(), 'DESCARTADA');
    assert.equal(mensajes.length, 2);

    // No quedan notificaciones propias disponibles.
    assert.equal(
      await servicio.procesarSiguiente(),
      'SIN_PENDIENTES',
    );

    const resultado = await database.query(
      `
        SELECT
          id_notificacion,
          estado_envio_correo,
          correo_intentos,
          correo_reserva,
          correo_reservado_hasta
        FROM obra.notificaciones
        WHERE id_proyecto = $1
      `,
      [proyecto],
    );

    assert.equal(resultado.rows.length, 3);

    const porId = new Map(
      resultado.rows.map((fila) => [fila.id_notificacion, fila]),
    );

    for (const [indice, id] of ids.entries()) {
      assert.deepEqual(porId.get(id), {
        id_notificacion: id,
        estado_envio_correo: indice === 0 ? 'ENVIADA' : 'FALLIDA',
        correo_intentos: 1,
        correo_reserva: null,
        correo_reservado_hasta: null,
      });
    }
  } finally {
    try {
      if (aislamiento) {
        try {
          await aislamiento.query('ROLLBACK');
        } finally {
          aislamiento.release(true);
        }
      }
    } finally {
      try {
        await database.withTransaction(async (client) => {
          // Las notificaciones y colaboraciones se eliminan en cascada.
          await client.query(
            'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
            [proyecto],
          );

          await client.query(
            'DELETE FROM obra.usuarios WHERE id_usuario = ANY($1::uuid[])',
            [[propietario, colaborador]],
          );
        });
      } finally {
        await Promise.all([
          database.onApplicationShutdown(),
          poolAislamiento.end(),
        ]);
      }
    }
  }
});