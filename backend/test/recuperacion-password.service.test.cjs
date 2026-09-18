require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RecuperacionPasswordService,
  MENSAJE_RECUPERACION,
} = require('../dist/modules/auth/services/recuperacion-password.service');

function preparar({ destinatario = 'persona@example.invalid',
  consumida = true, errorEmitir } = {}) {
  const operaciones = [];
  const mensajes = [];
  const client = {};
  let codigoEmitido;
  let consumo;

  const database = {
    async withTransaction(operacion) {
      operaciones.push('iniciar');
      const resultado = await operacion(client);
      operaciones.push('confirmar');
      return resultado;
    },
  };

  const repository = {
    async emitir(cliente, correo, codigo, secreto) {
      assert.strictEqual(cliente, client);
      assert.equal(correo, 'persona@example.invalid');
      assert.equal(secreto.length, 32);
      operaciones.push('emitir');
      codigoEmitido = codigo;
      if (errorEmitir) throw errorEmitir;
      return destinatario;
    },
    async consumir(cliente, correo, codigo, hash, secreto) {
      assert.strictEqual(cliente, client);
      assert.equal(secreto.length, 32);
      operaciones.push('consumir');
      consumo = { correo, codigo, hash };
      return consumida;
    },
  };

  const passwords = {
    async generarHash(password) {
      assert.equal(password, 'ClaveNueva123');
      operaciones.push('argon2');
      return 'hash-simulado';
    },
  };

  const correo = {
    async enviar(mensaje) {
      operaciones.push('correo');
      mensajes.push(mensaje);
    },
  };

  const anterior = process.env.AUTH_RECUPERACION_SECRET;
  let service;

  try {
    process.env.AUTH_RECUPERACION_SECRET = 'ab'.repeat(32);
    service = new RecuperacionPasswordService(
      database, repository, passwords, correo,
    );
  } finally {
    if (anterior === undefined) {
      delete process.env.AUTH_RECUPERACION_SECRET;
    } else {
      process.env.AUTH_RECUPERACION_SECRET = anterior;
    }
  }

  return {
    service, operaciones, mensajes,
    get codigoEmitido() { return codigoEmitido; },
    get consumo() { return consumo; },
  };
}

test('recuperación: confirma antes de enviar el código de ocho dígitos', async () => {
  const c = preparar();
  assert.deepEqual(
    await c.service.solicitar('persona@example.invalid'),
    { message: MENSAJE_RECUPERACION },
  );
  assert.match(c.codigoEmitido, /^[0-9]{8}$/);
  assert.deepEqual(c.operaciones, [
    'iniciar', 'emitir', 'confirmar', 'correo',
  ]);
  assert.equal(c.mensajes.length, 1);
  assert.ok(c.mensajes[0].texto.includes(`Tu código es: ${c.codigoEmitido}`));
});

test('recuperación: no envía correo para cuentas no recuperables', async () => {
  const c = preparar({ destinatario: null });
  assert.deepEqual(
    await c.service.solicitar('persona@example.invalid'),
    { message: MENSAJE_RECUPERACION },
  );
  assert.deepEqual(c.mensajes, []);
});

test('recuperación: no envía si falla el registro', async () => {
  const error = new Error('Fallo de registro');
  const c = preparar({ errorEmitir: error });
  await assert.rejects(
    () => c.service.solicitar('persona@example.invalid'),
    (recibido) => recibido === error,
  );
  assert.deepEqual(c.mensajes, []);
});

test('recuperación: conserva ceros iniciales y procesa Argon2 antes de la transacción', async () => {
  const c = preparar();
  await c.service.restablecer(
    'persona@example.invalid', '00123456', 'ClaveNueva123',
  );
  assert.deepEqual(c.operaciones, [
    'argon2', 'iniciar', 'consumir', 'confirmar',
  ]);
  assert.deepEqual(c.consumo, {
    correo: 'persona@example.invalid',
    codigo: '00123456',
    hash: 'hash-simulado',
  });
});

test('recuperación: rechaza códigos mal formados sin consultar PostgreSQL', async () => {
  const c = preparar();
  for (const codigo of ['1234567', '123456789', 'abcdefgh', 12345678]) {
    await assert.rejects(
      () => c.service.restablecer(
        'persona@example.invalid', codigo, 'ClaveNueva123',
      ),
      (error) => error.getStatus?.() === 400,
    );
  }
  assert.deepEqual(c.operaciones, []);
});

test('recuperación: confirma el intento fallido antes de devolver el error', async () => {
  const c = preparar({ consumida: false });
  await assert.rejects(
    () => c.service.restablecer(
      'persona@example.invalid', '00123456', 'ClaveNueva123',
    ),
    (error) => error.getStatus?.() === 400,
  );
  assert.deepEqual(c.operaciones, [
    'argon2', 'iniciar', 'consumir', 'confirmar',
  ]);
});