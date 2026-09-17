require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

const {
  getDatabaseConfig,
} = require('../../dist/database/database.config');

const {
  UsuariosAvatarRepository,
} = require('../../dist/modules/usuarios/usuarios-avatar.repository');

const {
  ArchivosPendientesRepository,
} = require('../../dist/modules/almacenamiento/archivos-pendientes.repository');

/**
 * Ejecuta dos sustituciones en conexiones independientes.
 *
 * La primera mantiene el bloqueo mientras la segunda intenta obtenerlo.
 * Los archivos son referencias ficticias: no se escribe en disco.
 */
test('avatar: serializa sustituciones concurrentes sin programar la eliminación del avatar vigente', async () => {
  const pool = new Pool({
    ...getDatabaseConfig(),
    max: 3,
    connectionTimeoutMillis: 5000,
  });

  const id = randomUUID();
  const inicial = `avatares/${randomUUID()}.webp`;
  const primera = `avatares/${randomUUID()}.webp`;
  const segunda = `avatares/${randomUUID()}.webp`;
  const claves = [inicial, primera, segunda];

  const avatares = new UsuariosAvatarRepository();
  const pendientes = new ArchivosPendientesRepository();

  let clientA;
  let clientB;
  let operacionB;

  try {
    await pool.query(
      `
        INSERT INTO obra.usuarios (
          id_usuario, correo, google_sub,
          foto_perfil_url, foto_perfil_key
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        id,
        `${id}@example.invalid`,
        `avatar-concurrente-${id}`,
        `/api/usuarios/${id}/avatar`,
        inicial,
      ],
    );

    clientA = await pool.connect();
    clientB = await pool.connect();

    for (const client of [clientA, clientB]) {
      await client.query("SET statement_timeout = '10s'");
      await client.query("SET lock_timeout = '5s'");
      await client.query('BEGIN');
    }

    // A obtiene el bloqueo y prepara la primera sustitución.
    const anteriorA = await avatares.bloquearCuentaActiva(clientA, id);
    assert.equal(anteriorA.foto_perfil_key, inicial);

    await avatares.actualizarReferencia(clientA, id, {
      url: `/api/usuarios/${id}/avatar`,
      clave: primera,
    });
    await pendientes.registrar(clientA, [anteriorA.foto_perfil_key]);

    /*
     * B solicita el mismo bloqueo antes de que A confirme.
     * Capturamos ambos resultados para evitar rechazos sin gestionar.
     */
    operacionB = avatares.bloquearCuentaActiva(clientB, id).then(
      (valor) => ({ valor }),
      (error) => ({ error }),
    );

    await clientA.query('COMMIT');

    const resultadoB = await operacionB;
    if (resultadoB.error) throw resultadoB.error;

    // B debe observar el avatar confirmado por A, no el inicial.
    assert.equal(resultadoB.valor.foto_perfil_key, primera);

    await avatares.actualizarReferencia(clientB, id, {
      url: `/api/usuarios/${id}/avatar`,
      clave: segunda,
    });
    await pendientes.registrar(
      clientB,
      [resultadoB.valor.foto_perfil_key],
    );

    await clientB.query('COMMIT');

    const usuario = await pool.query(
      `
        SELECT foto_perfil_key
        FROM obra.usuarios
        WHERE id_usuario = $1
      `,
      [id],
    );

    assert.equal(usuario.rows[0].foto_perfil_key, segunda);

    const tareas = await pool.query(
      `
        SELECT s3_key
        FROM obra.archivos_pendientes_eliminacion
        WHERE s3_key = ANY($1::text[])
        ORDER BY s3_key
      `,
      [claves],
    );

    assert.deepEqual(
      tareas.rows.map((fila) => fila.s3_key),
      [inicial, primera].sort(),
    );
  } finally {
    /*
     * Liberamos primero A para desbloquear cualquier consulta de B.
     * Esperamos B antes de enviar otra consulta por su conexión.
     */
    try {
      if (clientA) {
        try {
          await clientA.query('ROLLBACK');
        } finally {
          clientA.release();
        }
      }
    } finally {
      try {
        if (operacionB) await operacionB;

        if (clientB) {
          try {
            await clientB.query('ROLLBACK');
          } finally {
            clientB.release();
          }
        }
      } finally {
        try {
          await pool.query(
            'DELETE FROM obra.usuarios WHERE id_usuario = $1',
            [id],
          );

          await pool.query(
            `
              DELETE FROM obra.archivos_pendientes_eliminacion
              WHERE s3_key = ANY($1::text[])
            `,
            [claves],
          );
        } finally {
          await pool.end();
        }
      }
    }
  }
});