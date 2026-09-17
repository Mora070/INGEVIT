const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');

const {
  generarCodigoRecuperacion,
  esCodigoRecuperacion,
  getRecuperacionSecret,
  protegerCodigoRecuperacion,
  coincidenHashesRecuperacion,
} = require('../dist/modules/auth/utils/codigo-recuperacion');

test('código: genera exactamente ocho dígitos', () => {
  for (let i = 0; i < 100; i += 1) {
    assert.match(generarCodigoRecuperacion(), /^[0-9]{8}$/);
  }
});

test('código: acepta ceros iniciales y rechaza formatos incorrectos', () => {
  assert.equal(esCodigoRecuperacion('00000001'), true);

  for (const valor of [
    12345678, null, undefined, '', '1234567', '123456789',
    'abcdefgh', '12345678\n', ' 12345678',
  ]) {
    assert.equal(esCodigoRecuperacion(valor), false);
  }
});

test('código: exige una clave de protección de 32 bytes', () => {
  assert.equal(
    getRecuperacionSecret({
      AUTH_RECUPERACION_SECRET: 'ab'.repeat(32),
    }).length,
    32,
  );

  for (const valor of [undefined, '', 'a'.repeat(63), 'z'.repeat(64)]) {
    assert.throws(() =>
      getRecuperacionSecret({ AUTH_RECUPERACION_SECRET: valor }),
    );
  }
});

test('código: reproduce el HMAC sin almacenar el código original', () => {
  const secreto = randomBytes(32);
  const id = randomUUID();
  const hash = protegerCodigoRecuperacion(id, '00123456', secreto);

  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(
    protegerCodigoRecuperacion(id, '00123456', secreto),
    hash,
  );
});

test('código: vincula la protección a la cuenta, el código y la clave secreta', () => {
  const secreto = randomBytes(32);
  const id = randomUUID();
  const hash = protegerCodigoRecuperacion(id, '00123456', secreto);

  assert.notEqual(
    protegerCodigoRecuperacion(randomUUID(), '00123456', secreto),
    hash,
  );
  assert.notEqual(
    protegerCodigoRecuperacion(id, '00123457', secreto),
    hash,
  );
  assert.notEqual(
    protegerCodigoRecuperacion(id, '00123456', randomBytes(32)),
    hash,
  );
});

test('código: compara hashes y rechaza representaciones inválidas', () => {
  const hash = protegerCodigoRecuperacion(
    randomUUID(), '00123456', randomBytes(32),
  );

  assert.equal(coincidenHashesRecuperacion(hash, hash), true);
  assert.equal(coincidenHashesRecuperacion(hash, '0'.repeat(64)), false);
  assert.equal(coincidenHashesRecuperacion(hash, ''), false);
  assert.equal(coincidenHashesRecuperacion(hash, 'g'.repeat(64)), false);
});