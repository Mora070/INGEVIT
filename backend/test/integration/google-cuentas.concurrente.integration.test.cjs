require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  GoogleCuentasRepository,
} = require('../../dist/modules/auth/google-cuentas.repository');

/**
 * Lanza varias solicitudes sobre una identidad nueva.
 * Cada llamada utiliza su propia transacción real.
 * Debe existir una única cuenta al finalizar.
 */
test('Google cuentas: solicitudes concurrentes de una identidad devuelven la misma cuenta', async () => {
  const database = new DatabaseService();
  const repository = new GoogleCuentasRepository(database);

  const identidad = {
    sub: `google-concurrente-${randomUUID()}`,
    correo: `${randomUUID()}@example.invalid`,
    nombre: 'Cuenta de prueba',
    apellidos: null,
  };

  await database.onModuleInit();

  try {
    /*
     * Esperamos todas las operaciones incluso si alguna falla.
     * La limpieza nunca se ejecuta mientras quedan escrituras pendientes.
     */
    const resultados = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        repository.obtenerOCrear(identidad),
      ),
    );

    const cuentas = [];

    for (const resultado of resultados) {
      if (resultado.status === 'rejected') {
        throw resultado.reason;
      }

      assert.ok(resultado.value);
      cuentas.push(resultado.value);
    }

    const id = cuentas[0].id_usuario;

    for (const cuenta of cuentas) {
      assert.equal(cuenta.id_usuario, id);
      assert.equal(cuenta.google_sub, identidad.sub);
      assert.equal(cuenta.password_hash, null);
      assert.equal(cuenta.rol, 'USUARIO');
      assert.equal(cuenta.estado, 'ACTIVO');
    }

    const registros = await database.query(
      `
        SELECT id_usuario
        FROM obra.usuarios
        WHERE google_sub = $1 OR lower(correo) = lower($2)
      `,
      [identidad.sub, identidad.correo],
    );

    assert.equal(registros.rowCount, 1);
    assert.equal(registros.rows[0].id_usuario, id);
  } finally {
    try {
      await database.query(
        'DELETE FROM obra.usuarios WHERE google_sub = $1',
        [identidad.sub],
      );
    } finally {
      await database.onApplicationShutdown();
    }
  }
}); 