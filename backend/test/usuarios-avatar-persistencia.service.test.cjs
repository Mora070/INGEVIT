require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  UsuariosAvatarPersistenciaService,
} = require('../dist/modules/usuarios/usuarios-avatar-persistencia.service');

const {
  ResultadoTransaccionDesconocidoError,
} = require('../dist/database/errors/resultado-transaccion-desconocido.error');

const CLAVE =
  'avatares/10000000-0000-4000-8000-000000000001.webp';

const CONTENIDO = Buffer.from('avatar optimizado de prueba');

/**
 * Comprueba la coordinación sin escribir archivos ni consultar PostgreSQL.
 * Las pruebas de integración cubren las transacciones reales.
 */
function preparar({
  errorGuardar,
  errorRegistrar,
  errorEliminar,
} = {}) {
  const operaciones = [];

  const archivos = {
    async guardarOptimizado(contenido) {
      assert.strictEqual(contenido, CONTENIDO);
      operaciones.push('guardar');

      if (errorGuardar) throw errorGuardar;

      return CLAVE;
    },
  };

  const almacenamiento = {
    async eliminar(clave) {
      assert.equal(clave, CLAVE);
      operaciones.push('eliminar');

      if (errorEliminar) throw errorEliminar;
    },
  };

  const service = new UsuariosAvatarPersistenciaService(
    archivos,
    almacenamiento,
  );

  return {
    operaciones,
    ejecutar: () =>
      service.guardarYRegistrar(CONTENIDO, async (clave) => {
        assert.equal(clave, CLAVE);
        operaciones.push('registrar');

        if (errorRegistrar) throw errorRegistrar;
      }),
  };
}

test('avatar persistencia: guarda antes de registrar y conserva el archivo al finalizar', async () => {
  const contexto = preparar();

  await contexto.ejecutar();

  assert.deepEqual(contexto.operaciones, ['guardar', 'registrar']);
});

test('avatar persistencia: no registra ni elimina cuando falla la escritura', async () => {
  const error = new Error('Escritura rechazada');
  const contexto = preparar({ errorGuardar: error });

  await assert.rejects(contexto.ejecutar, (recibido) => recibido === error);

  assert.deepEqual(contexto.operaciones, ['guardar']);
});

test('avatar persistencia: compensa el archivo nuevo ante un registro revertido', async () => {
  const error = new Error('Registro revertido');
  const contexto = preparar({ errorRegistrar: error });

  await assert.rejects(contexto.ejecutar, (recibido) => recibido === error);

  assert.deepEqual(contexto.operaciones, [
    'guardar',
    'registrar',
    'eliminar',
  ]);
});

for (const fase of ['COMMIT', 'ROLLBACK']) {
  test(`avatar persistencia: conserva el archivo ante incertidumbre de ${fase}`, async () => {
    const error = new ResultadoTransaccionDesconocidoError(
      fase,
      new Error('Conexión interrumpida'),
    );

    const contexto = preparar({ errorRegistrar: error });

    await assert.rejects(
      contexto.ejecutar,
      (recibido) => recibido === error,
    );

    assert.deepEqual(contexto.operaciones, ['guardar', 'registrar']);
  });
}

test('avatar persistencia: conserva ambos errores si también falla la compensación', async () => {
  const errorRegistro = new Error('Registro revertido');
  const errorLimpieza = new Error('Almacenamiento no disponible');

  const contexto = preparar({
    errorRegistrar: errorRegistro,
    errorEliminar: errorLimpieza,
  });

  await assert.rejects(contexto.ejecutar, (error) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [errorRegistro, errorLimpieza]);
    return true;
  });

  assert.deepEqual(contexto.operaciones, [
    'guardar',
    'registrar',
    'eliminar',
  ]);
});