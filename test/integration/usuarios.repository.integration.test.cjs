require('reflect-metadata');

const { test } = require('node:test');
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
 * Prueba las consultas del repositorio contra PostgreSQL real.
 *
 * Requisitos:
 * - Ejecutar exclusivamente contra la base local de desarrollo.
 * - Tener configuradas las variables DB_*.
 * - La cuenta necesita SELECT e INSERT sobre obra.usuarios.
 *
 * Todos los datos de prueba se revierten al finalizar.
 */
test('UsuariosRepository funciona con PostgreSQL real', async () => {
  const pool = new Pool(getDatabaseConfig());

  pool.on('error', () => {
    console.error('Se perdió una conexión ociosa durante la prueba.');
    process.exitCode = 1;
  });

  try {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const idUsuario = randomUUID();
      const correo = `integracion-${idUsuario}@example.test`;
      const googleSub = `google-prueba-${idUsuario}`;

      /*
       * Cuenta ficticia exclusiva de Google.
       * No almacenamos una contraseña ni un hash simulado.
       *
       * Usamos INACTIVO para comprobar que el repositorio también
       * recupera cuentas que el servicio debe bloquear posteriormente.
       */
      await client.query(
        `
          INSERT INTO obra.usuarios (
            id_usuario,
            nombre,
            correo,
            google_sub,
            estado
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          idUsuario,
          'Usuario de integración',
          correo,
          googleSub,
          'INACTIVO',
        ],
      );

      /*
       * Adaptador de prueba respaldado por una conexión real.
       *
       * Todas las consultas del repositorio utilizan el mismo cliente
       * que insertó el usuario. Así pueden ver los datos sin confirmar
       * y permanecen dentro de la transacción de prueba.
       *
       * No utilizamos pool.query(), porque podría elegir otra conexión.
       */
      const database = {
        query(sql, values) {
          return client.query(sql, values);
        },
      };

      const repository = new UsuariosRepository(database);

      // Búsqueda por UUID y conversión real de tipos de PostgreSQL.
      const porId = await repository.findById(idUsuario);

      assert.ok(porId, 'Debe encontrar al usuario por su UUID.');
      assert.equal(porId.id_usuario, idUsuario);
      assert.equal(porId.estado, 'INACTIVO');
      assert.equal(porId.password_hash, null);
      assert.equal(porId.apellidos, null);
      assert.ok(porId.fecha_creacion instanceof Date);
      assert.ok(!Number.isNaN(porId.fecha_creacion.getTime()));

      // El correo debe admitir mayúsculas y espacios exteriores.
      const porCorreo = await repository.findByCorreo(
        `  ${correo.toUpperCase()}  `,
      );

      assert.ok(porCorreo, 'Debe encontrar al usuario por correo.');
      assert.equal(porCorreo.id_usuario, idUsuario);

      // La identidad Google debe recuperar la misma cuenta.
      const porGoogle = await repository.findByGoogleSub(googleSub);

      assert.ok(porGoogle, 'Debe encontrar al usuario por Google.');
      assert.equal(porGoogle.id_usuario, idUsuario);

      // Una cuenta inexistente debe producir null, no una excepción.
      const inexistente = randomUUID();

      assert.equal(
        await repository.findById(inexistente),
        null,
      );

      assert.equal(
        await repository.findByCorreo(
          `inexistente-${inexistente}@example.test`,
        ),
        null,
      );

      assert.equal(
        await repository.findByGoogleSub(
          `google-inexistente-${inexistente}`,
        ),
        null,
      );

      // El contenido se interpreta como un valor, no como SQL.
      const entradaMaliciosa = `${correo}' OR 1=1 --`;

      assert.equal(
        await repository.findByCorreo(entradaMaliciosa),
        null,
      );
    } finally {
      /*
       * Nunca confirmamos los datos de esta prueba.
       *
       * Destruimos la conexión al terminar. Si ROLLBACK falla,
       * no devolvemos al pool una conexión con estado incierto.
       */
      try {
        await client.query('ROLLBACK');
      } finally {
        client.release(true);
      }
    }
  } finally {
    await pool.end();
  }
});