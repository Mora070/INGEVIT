require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

const {
  getDatabaseConfig,
} = require('../../dist/database/database.config');

const {
  UsuariosRepository,
} = require('../../dist/modules/usuarios/usuarios.repository');

/**
 * Ejecuta dos actualizaciones desde conexiones independientes.
 *
 * Ambas utilizan el mismo hash anterior, como ocurriría si dos
 * solicitudes verificaran la contraseña antes de guardar el cambio.
 *
 * Solo una debe actualizar la cuenta. La otra debe devolver false.
 * Los textos representan hashes ficticios: aquí se prueba PostgreSQL,
 * no la verificación criptográfica.
 */
test('password: dos cambios concurrentes producen un ganador y un único incremento de versión', async () => {
  const pool = new Pool({
    ...getDatabaseConfig(),
    max: 2,
    connectionTimeoutMillis: 5_000,
  });

  const id = randomUUID();
  const hashAnterior = 'hash-anterior-concurrencia';
  const candidatos = [
    'hash-nuevo-primer-intento',
    'hash-nuevo-segundo-intento',
  ];

  let primero;
  let segundo;

  try {
    await pool.query(
      `
        INSERT INTO obra.usuarios (
          id_usuario, correo, password_hash
        )
        VALUES ($1, $2, $3)
      `,
      [id, `${id}@example.invalid`, hashAnterior],
    );

    primero = await pool.connect();
    segundo = await pool.connect();

    for (const client of [primero, segundo]) {
      await client.query("SET statement_timeout = '5s'");
      await client.query("SET lock_timeout = '3s'");
    }

    const repositorios = [primero, segundo].map(
      (client) => new UsuariosRepository({
        query: (sql, values) => client.query(sql, values),
      }),
    );

    /*
     * Las dos consultas se lanzan antes de esperar sus resultados.
     * Cada UPDATE utiliza su propia transacción implícita.
     *
     * Esperamos ambas operaciones incluso si una falla, para no
     * iniciar la limpieza mientras quede una escritura pendiente.
     */
    const resultados = await Promise.allSettled(
      repositorios.map((repository, indice) =>
        repository.actualizarPasswordSiCoincide(
          id,
          hashAnterior,
          candidatos[indice],
        ),
      ),
    );

    for (const resultado of resultados) {
      if (resultado.status === 'rejected') {
        throw resultado.reason;
      }
    }

    const valores = resultados.map((resultado) => resultado.value);

    assert.equal(
      valores.filter((valor) => valor === true).length,
      1,
    );

    assert.equal(
      valores.filter((valor) => valor === false).length,
      1,
    );

    const indiceGanador = valores.indexOf(true);

    const almacenado = await primero.query(
      `
        SELECT password_hash, version_sesion, estado, rol
        FROM obra.usuarios
        WHERE id_usuario = $1
      `,
      [id],
    );

    assert.deepEqual(almacenado.rows[0], {
      password_hash: candidatos[indiceGanador],
      version_sesion: 1,
      estado: 'ACTIVO',
      rol: 'USUARIO',
    });

    // El intento perdedor tampoco puede sobrescribir después.
    assert.equal(
      await repositorios[1 - indiceGanador]
        .actualizarPasswordSiCoincide(
          id,
          hashAnterior,
          'hash-que-no-debe-guardarse',
        ),
      false,
    );

    const final = await primero.query(
      `
        SELECT password_hash, version_sesion
        FROM obra.usuarios
        WHERE id_usuario = $1
      `,
      [id],
    );

    assert.deepEqual(final.rows[0], {
      password_hash: candidatos[indiceGanador],
      version_sesion: 1,
    });
  } finally {
    // Destruimos las conexiones para no conservar ajustes de sesión.
    if (primero) primero.release(true);
    if (segundo) segundo.release(true);

    try {
      await pool.query(
        'DELETE FROM obra.usuarios WHERE id_usuario = $1',
        [id],
      );
    } finally {
      await pool.end();
    }
  }
});