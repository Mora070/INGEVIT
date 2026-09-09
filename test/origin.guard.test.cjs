require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ForbiddenException } = require('@nestjs/common');

const {
  OriginGuard,
} = require('../dist/modules/auth/guards/origin.guard');

const {
  getAuthAllowedOrigins,
} = require('../dist/modules/auth/auth-origin.config');

const ORIGEN_LOCAL = 'http://127.0.0.1:3000';

/**
 * Simula únicamente la parte del contexto HTTP que usa el guard.
 * No inicia un servidor ni modifica variables de entorno.
 */
function crearContexto(method, origin) {
  return {
    switchToHttp() {
      return {
        getRequest() {
          return {
            method,
            headers: origin === undefined ? {} : { origin },
          };
        },
      };
    },
  };
}

function comprobarOrigenRechazado(error) {
  assert.ok(error instanceof ForbiddenException);
  assert.equal(error.getStatus(), 403);
  assert.equal(
    error.message,
    'El origen de la solicitud no está permitido.',
  );

  return true;
}

test('OriginGuard: permite métodos de consulta sin encabezado Origin', () => {
  const guard = new OriginGuard(new Set([ORIGEN_LOCAL]));

  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    assert.equal(
      guard.canActivate(crearContexto(method, undefined)),
      true,
    );
  }
});

test('OriginGuard: permite operaciones con un origen autorizado exacto', () => {
  const guard = new OriginGuard(new Set([ORIGEN_LOCAL]));

  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(
      guard.canActivate(crearContexto(method, ORIGEN_LOCAL)),
      true,
    );
  }
});

test('OriginGuard: rechaza operaciones sin encabezado Origin', () => {
  const guard = new OriginGuard(new Set([ORIGEN_LOCAL]));

  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.throws(
      () => guard.canActivate(crearContexto(method, undefined)),
      comprobarOrigenRechazado,
    );
  }
});

test('OriginGuard: rechaza orígenes nulos, vacíos o múltiples', () => {
  const guard = new OriginGuard(new Set([ORIGEN_LOCAL]));

  const valoresInvalidos = [
    'null',
    '',
    ' ',
    null,
    [ORIGEN_LOCAL],
    `${ORIGEN_LOCAL}, https://otro.example`,
  ];

  for (const origin of valoresInvalidos) {
    assert.throws(
      () => guard.canActivate(crearContexto('POST', origin)),
      comprobarOrigenRechazado,
    );
  }
});

test('OriginGuard: rechaza dominios parecidos y cambios de protocolo o puerto', () => {
  const guard = new OriginGuard(
    new Set(['https://app.example.test']),
  );

  const origenesNoAutorizados = [
    'https://app.example.test.atacante.test',
    'https://otro.app.example.test',
    'http://app.example.test',
    'https://app.example.test:8443',
    'https://app.example.test/',
  ];

  for (const origin of origenesNoAutorizados) {
    assert.throws(
      () => guard.canActivate(crearContexto('POST', origin)),
      comprobarOrigenRechazado,
    );
  }
});

test('OriginGuard: no considera equivalentes localhost y 127.0.0.1', () => {
  const guard = new OriginGuard(new Set([ORIGEN_LOCAL]));

  assert.throws(
    () =>
      guard.canActivate(
        crearContexto('POST', 'http://localhost:3000'),
      ),
    comprobarOrigenRechazado,
  );
});

test('getAuthAllowedOrigins: admite varios orígenes y elimina duplicados', () => {
  const resultado = getAuthAllowedOrigins({
    NODE_ENV: 'development',
    AUTH_ALLOWED_ORIGINS:
      `${ORIGEN_LOCAL}, https://app.example.test, ${ORIGEN_LOCAL}`,
  });

  assert.deepEqual(
    [...resultado],
    [ORIGEN_LOCAL, 'https://app.example.test'],
  );
});

test('getAuthAllowedOrigins: rechaza una configuración ausente o vacía', () => {
  for (const valor of [undefined, '', '   ']) {
    assert.throws(
      () =>
        getAuthAllowedOrigins({
          NODE_ENV: 'development',
          AUTH_ALLOWED_ORIGINS: valor,
        }),
      {
        message:
          'Configuración de origen incompleta: falta AUTH_ALLOWED_ORIGINS.',
      },
    );
  }
});

test('getAuthAllowedOrigins: rechaza URLs que no representan un origen exacto', () => {
  const valoresInvalidos = [
    '*',
    'null',
    'no-es-una-url',
    'ftp://app.example.test',
    'https://app.example.test/',
    'https://app.example.test/ruta',
    'https://app.example.test?consulta=1',
    'https://app.example.test#fragmento',
    'https://usuario:clave@app.example.test',
    `${ORIGEN_LOCAL},`,
  ];

  for (const valor of valoresInvalidos) {
    assert.throws(
      () =>
        getAuthAllowedOrigins({
          NODE_ENV: 'development',
          AUTH_ALLOWED_ORIGINS: valor,
        }),
      (error) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /AUTH_ALLOWED_ORIGINS/);
        return true;
      },
    );
  }
});

test('getAuthAllowedOrigins: rechaza HTTP en producción', () => {
  assert.throws(
    () =>
      getAuthAllowedOrigins({
        NODE_ENV: 'production',
        AUTH_ALLOWED_ORIGINS: ORIGEN_LOCAL,
      }),
    {
      message:
        'Los orígenes permitidos deben utilizar HTTPS en producción.',
    },
  );
});

test('getAuthAllowedOrigins: admite HTTPS en producción', () => {
  const resultado = getAuthAllowedOrigins({
    NODE_ENV: 'production',
    AUTH_ALLOWED_ORIGINS: 'https://app.example.test',
  });

  assert.deepEqual([...resultado], ['https://app.example.test']);
});