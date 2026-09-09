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

const {
  PasswordService,
} = require('../../dist/modules/auth/services/password.service');

test('crearTradicional: inserta en PostgreSQL y conserva la cuenta ante un correo duplicado', async () => {
  const pool = new Pool(getDatabaseConfig());

  pool.on('error', () => {
    console.error(
      'Se produjo un error en una conexión ociosa de la prueba.',
    );
    process.exitCode = 1;
  });

  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    /**
     * Todas las consultas del repositorio utilizan la misma conexión.
     * Así quedan dentro de la transacción que revertiremos al finalizar.
     */
    const repository = new UsuariosRepository({
      query(sql, values) {
        return client.query(sql, values);
      },
    });

    const passwordService = new PasswordService();
    const password = 'Clave ficticia de integración';
    const passwordHash = await passwordService.generarHash(password);

    // Cada ejecución utiliza un correo distinto.
    const correo = `registro-${randomUUID()}@example.test`;

    const creado = await repository.crearTradicional({
      correo: `  ${correo}  `,
      passwordHash,
      nombre: null,
      apellidos: null,
      telefono: null,
      ubicacion: null,
    });

    assert.ok(creado);

    // PostgreSQL debe generar el identificador y la fecha.
    assert.match(
      creado.id_usuario,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    assert.ok(creado.fecha_creacion instanceof Date);
    assert.ok(Number.isFinite(creado.fecha_creacion.getTime()));

    assert.equal(creado.correo, correo);
    assert.equal(creado.rol, 'USUARIO');
    assert.equal(creado.estado, 'ACTIVO');
    assert.equal(creado.google_sub, null);
    assert.equal(creado.foto_perfil_url, null);

    assert.equal(creado.nombre, null);
    assert.equal(creado.apellidos, null);
    assert.equal(creado.telefono, null);
    assert.equal(creado.ubicacion, null);

    assert.equal(creado.password_hash, passwordHash);
    assert.equal(
      await passwordService.verificar(password, creado.password_hash),
      true,
    );

    /**
     * Intentamos registrar el mismo correo con otras mayúsculas
     * y datos diferentes. La cuenta original no debe modificarse.
     */
    const otroHash = await passwordService.generarHash(
      'Otra clave ficticia',
    );

    const duplicado = await repository.crearTradicional({
      correo: correo.toUpperCase(),
      passwordHash: otroHash,
      nombre: 'No debe reemplazar el nombre',
      apellidos: 'No debe reemplazar los apellidos',
      telefono: '000000',
      ubicacion: 'No debe reemplazar la ubicación',
    });

    assert.equal(duplicado, null);

    const conservado = await repository.findById(creado.id_usuario);

    assert.ok(conservado);
    assert.deepEqual(conservado, creado);

    /**
     * Verifica que existe una sola fila para el correo,
     * independientemente de sus mayúsculas.
     */
    const conteo = await client.query(
      `
        SELECT count(*)::integer AS cantidad
        FROM obra.usuarios
        WHERE lower(correo) = lower($1::text)
      `,
      [correo],
    );

    assert.equal(conteo.rows[0].cantidad, 1);
  } finally {
    /**
     * Incluso si falla una comprobación, intentamos revertir los datos.
     * Descartamos la conexión al liberarla para no reutilizarla.
     */
    try {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } finally {
          client.release(true);
        }
      }
    } finally {
      await pool.end();
    }
  }
});