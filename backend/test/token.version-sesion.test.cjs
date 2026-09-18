require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { UnauthorizedException } = require('@nestjs/common');
const { JsonWebTokenError } = require('@nestjs/jwt');

const {
  TokenService,
} = require('../dist/modules/auth/services/token.service');

const ID = '20000000-0000-4000-8000-000000000001';

function claims(cambios = {}) {
  return {
    sub: ID,
    iat: 100,
    exp: 200,
    version_sesion: 3,
    ...cambios,
  };
}

test('token versionado: incluye la versión interna al firmar', async () => {
  let firmado;

  const service = new TokenService({
    async signAsync(payload) {
      firmado = payload;
      return 'token-firmado';
    },
  });

  assert.equal(
    await service.emitirTokenConVersion(ID, 3),
    'token-firmado',
  );

  assert.deepEqual(firmado, {
    sub: ID,
    version_sesion: 3,
  });
});

test('token versionado: rechaza identidades y versiones internas inválidas', async () => {
  let firmas = 0;

  const service = new TokenService({
    async signAsync() {
      firmas += 1;
      return 'token';
    },
  });

  for (const version of [
    undefined, null, '0', -1, 1.5, NaN, Infinity, 2_147_483_648,
  ]) {
    await assert.rejects(
      () => service.emitirTokenConVersion(ID, version),
      /identidad interna/,
    );
  }

  await assert.rejects(
    () => service.emitirTokenConVersion('identificador-invalido', 0),
    /identidad interna/,
  );

  assert.equal(firmas, 0);
});

test('token versionado: devuelve identidad y versión verificando una sola vez', async () => {
  let verificaciones = 0;

  const service = new TokenService({
    async verifyAsync(token) {
      assert.equal(token, 'token-recibido');
      verificaciones += 1;
      return claims();
    },
  });

  assert.deepEqual(
    await service.verificarTokenConVersion('token-recibido'),
    {
      id_usuario: ID,
      version_sesion: 3,
    },
  );

  assert.equal(verificaciones, 1);
});

test('token versionado: admite cero y rechaza versiones ausentes o inválidas', async () => {
  let version = 0;

  const service = new TokenService({
    async verifyAsync() {
      return claims({ version_sesion: version });
    },
  });

  assert.equal(
    (await service.verificarTokenConVersion('token')).version_sesion,
    0,
  );

  for (const valor of [
    undefined, null, '0', -1, 0.5, NaN, Infinity, 2_147_483_648,
  ]) {
    version = valor;

    await assert.rejects(
      () => service.verificarTokenConVersion('token'),
      UnauthorizedException,
    );
  }
});

test('token versionado: exige también identidad y fechas válidas', async () => {
  for (const payload of [
    null,
    [],
    claims({ sub: 'invalido' }),
    claims({ iat: undefined }),
    claims({ exp: undefined }),
    claims({ exp: 100 }),
  ]) {
    const service = new TokenService({
      async verifyAsync() {
        return payload;
      },
    });

    await assert.rejects(
      () => service.verificarTokenConVersion('token'),
      UnauthorizedException,
    );
  }
});

test('token versionado: distingue errores criptográficos de fallos técnicos', async () => {
  const criptografico = new TokenService({
    async verifyAsync() {
      throw new JsonWebTokenError('Firma inválida');
    },
  });

  await assert.rejects(
    () => criptografico.verificarTokenConVersion('token'),
    UnauthorizedException,
  );

  const error = new Error('Fallo técnico');
  const tecnico = new TokenService({
    async verifyAsync() {
      throw error;
    },
  });

  await assert.rejects(
    () => tecnico.verificarTokenConVersion('token'),
    (recibido) => recibido === error,
  );
});