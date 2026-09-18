require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  UsuariosAvatarService,
} = require('../dist/modules/usuarios/usuarios-avatar.service');

const ID = '10000000-0000-4000-8000-000000000001';

const ANTERIOR = {
  foto_perfil_url: '/avatar-anterior.webp',
  foto_perfil_key:
    'avatares/20000000-0000-4000-8000-000000000002.webp',
};

const NUEVO = {
  url: '/avatar-nuevo.webp',
  clave: 'avatares/30000000-0000-4000-8000-000000000003.webp',
};

/**
 * Comprueba la coordinación del servicio.
 *
 * El doble de transacción registra cuándo termina la operación,
 * pero no simula una reversión de PostgreSQL. La atomicidad real
 * se comprobará en integración.
 */
function preparar({
  actual = ANTERIOR,
  errorActualizar,
  errorRegistrar,
} = {}) {
  const client = {};
  const operaciones = [];
  const actualizaciones = [];
  const pendientes = [];

  const database = {
    async withTransaction(operacion) {
      operaciones.push('iniciar');
      const resultado = await operacion(client);
      operaciones.push('confirmar');
      return resultado;
    },
  };

  const avatares = {
    async bloquearCuentaActiva(cliente, idUsuario) {
      assert.strictEqual(cliente, client);
      assert.equal(idUsuario, ID);
      operaciones.push('bloquear');
      return actual;
    },

    async actualizarReferencia(cliente, idUsuario, avatar) {
      assert.strictEqual(cliente, client);
      assert.equal(idUsuario, ID);
      operaciones.push('actualizar');
      actualizaciones.push(avatar);

      if (errorActualizar) {
        throw errorActualizar;
      }
    },
  };

  const archivosPendientes = {
    async registrar(cliente, claves) {
      assert.strictEqual(cliente, client);
      operaciones.push('registrar');
      pendientes.push([...claves]);

      if (errorRegistrar) {
        throw errorRegistrar;
      }
    },
  };

  return {
    service: new UsuariosAvatarService(
      database,
      avatares,
      archivosPendientes,
    ),
    operaciones,
    actualizaciones,
    pendientes,
  };
}

test('avatar: sustituye la referencia y registra únicamente el archivo anterior', async () => {
  const contexto = preparar();

  await contexto.service.cambiarReferencia(ID, NUEVO);

  assert.deepEqual(contexto.actualizaciones, [NUEVO]);
  assert.deepEqual(contexto.pendientes, [[ANTERIOR.foto_perfil_key]]);
  assert.deepEqual(contexto.operaciones, [
    'iniciar',
    'bloquear',
    'actualizar',
    'registrar',
    'confirmar',
  ]);
});

test('avatar: guarda la primera fotografía sin registrar eliminaciones', async () => {
  const contexto = preparar({
    actual: {
      foto_perfil_url: null,
      foto_perfil_key: null,
    },
  });

  await contexto.service.cambiarReferencia(ID, NUEVO);

  assert.deepEqual(contexto.actualizaciones, [NUEVO]);
  assert.deepEqual(contexto.pendientes, []);
  assert.deepEqual(contexto.operaciones, [
    'iniciar',
    'bloquear',
    'actualizar',
    'confirmar',
  ]);
});

test('avatar: retira la referencia y programa la eliminación del archivo anterior', async () => {
  const contexto = preparar();

  await contexto.service.cambiarReferencia(ID, null);

  assert.deepEqual(contexto.actualizaciones, [null]);
  assert.deepEqual(contexto.pendientes, [[ANTERIOR.foto_perfil_key]]);
  assert.deepEqual(contexto.operaciones, [
    'iniciar',
    'bloquear',
    'actualizar',
    'registrar',
    'confirmar',
  ]);
});

test('avatar: retirar una fotografía inexistente no genera escrituras', async () => {
  const contexto = preparar({
    actual: {
      foto_perfil_url: null,
      foto_perfil_key: null,
    },
  });

  await contexto.service.cambiarReferencia(ID, null);

  assert.deepEqual(contexto.actualizaciones, []);
  assert.deepEqual(contexto.pendientes, []);
  assert.deepEqual(contexto.operaciones, [
    'iniciar',
    'bloquear',
    'confirmar',
  ]);
});

test('avatar: rechaza una cuenta inexistente o inactiva', async () => {
  const contexto = preparar({ actual: null });

  await assert.rejects(
    () => contexto.service.cambiarReferencia(ID, NUEVO),
    (error) =>
      error.getStatus?.() === 401 &&
      error.message === 'La sesión no es válida o ha expirado.',
  );

  assert.deepEqual(contexto.operaciones, ['iniciar', 'bloquear']);
  assert.deepEqual(contexto.actualizaciones, []);
  assert.deepEqual(contexto.pendientes, []);
});

test('avatar: rechaza reutilizar la clave actual', async () => {
  const contexto = preparar();

  await assert.rejects(
    () =>
      contexto.service.cambiarReferencia(ID, {
        url: '/otra-url.webp',
        clave: ANTERIOR.foto_perfil_key,
      }),
    { message: 'El nuevo avatar debe utilizar una clave diferente.' },
  );

  assert.deepEqual(contexto.operaciones, ['iniciar', 'bloquear']);
  assert.deepEqual(contexto.actualizaciones, []);
  assert.deepEqual(contexto.pendientes, []);
});

test('avatar: no registra eliminaciones cuando falla la actualización', async () => {
  const error = new Error('Fallo simulado de actualización');
  const contexto = preparar({ errorActualizar: error });

  await assert.rejects(
    () => contexto.service.cambiarReferencia(ID, NUEVO),
    (recibido) => recibido === error,
  );

  assert.deepEqual(contexto.pendientes, []);
  assert.deepEqual(contexto.operaciones, [
    'iniciar',
    'bloquear',
    'actualizar',
  ]);
});

test('avatar: propaga el fallo de la cola para que la transacción se revierta', async () => {
  const error = new Error('Fallo simulado al registrar la eliminación');
  const contexto = preparar({ errorRegistrar: error });

  await assert.rejects(
    () => contexto.service.cambiarReferencia(ID, NUEVO),
    (recibido) => recibido === error,
  );

  assert.deepEqual(contexto.operaciones, [
    'iniciar',
    'bloquear',
    'actualizar',
    'registrar',
  ]);
});