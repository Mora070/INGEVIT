require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { NotFoundException } = require('@nestjs/common');

const {
  getDatabaseConfig,
} = require('../../dist/database/database.config');

const {
  UsuariosRepository,
} = require('../../dist/modules/usuarios/usuarios.repository');

const {
  UsuariosService,
} = require('../../dist/modules/usuarios/usuarios.service');

const {
  PasswordService,
} = require('../../dist/modules/auth/services/password.service');

test('actualizarEstado: cambia únicamente el estado y permite reactivar la cuenta', async () => {
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
     * El repositorio utiliza exclusivamente esta conexión.
     * Todas las operaciones quedan dentro de la misma transacción.
     */
    const repository = new UsuariosRepository({
      query(sql, values) {
        return client.query(sql, values);
      },
    });

    const service = new UsuariosService(repository);
    const passwordService = new PasswordService();

    const original = await repository.crearTradicional({
      correo: `estado-${randomUUID()}@example.test`,
      passwordHash: await passwordService.generarHash(
        'Clave ficticia de integración',
      ),
      nombre: 'Persona de integración',
      apellidos: 'Prueba de estado',
      telefono: '+57 03001234567',
      ubicacion: 'Bogotá',
    });

    assert.ok(original);
    assert.equal(original.estado, 'ACTIVO');

    // 1. Inactivación mediante el servicio real.
    const perfilInactivo = await service.actualizarEstado(
      original.id_usuario,
      'INACTIVO',
    );

    assert.equal(perfilInactivo.id_usuario, original.id_usuario);
    assert.equal(perfilInactivo.estado, 'INACTIVO');
    assert.equal(
      Object.hasOwn(perfilInactivo, 'password_hash'),
      false,
    );
    assert.equal(
      Object.hasOwn(perfilInactivo, 'google_sub'),
      false,
    );

    const filaInactiva = await repository.findById(
      original.id_usuario,
    );

    /**
     * La comparación completa detecta cambios inesperados
     * en nombre, correo, rol, hash, fecha u otros campos.
     */
    assert.deepEqual(filaInactiva, {
      ...original,
      estado: 'INACTIVO',
    });

    // 2. Repetir el mismo estado debe seguir siendo válido.
    const perfilRepetido = await service.actualizarEstado(
      original.id_usuario,
      'INACTIVO',
    );

    assert.deepEqual(perfilRepetido, perfilInactivo);

    // 3. Reactivación.
    const perfilActivo = await service.actualizarEstado(
      original.id_usuario,
      'ACTIVO',
    );

    assert.equal(perfilActivo.estado, 'ACTIVO');

    const filaReactivada = await repository.findById(
      original.id_usuario,
    );

    assert.deepEqual(filaReactivada, original);

    // 4. Un UUID válido que no corresponde a ninguna cuenta.
    const idInexistente = randomUUID();

    assert.equal(
      await repository.findById(idInexistente),
      null,
    );

    const resultado = await repository.actualizarEstado(
      idInexistente,
      'INACTIVO',
    );

    assert.equal(resultado, null);

    // El servicio convierte ese resultado en HTTP 404.
    await assert.rejects(
      () => service.actualizarEstado(idInexistente, 'INACTIVO'),
      (error) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.getStatus(), 404);
        assert.equal(error.message, 'El usuario no existe.');
        return true;
      },
    );
  } finally {
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