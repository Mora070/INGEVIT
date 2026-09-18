const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  getAuthCookieOptions,
} = require('../dist/modules/auth/auth-cookie.config');

const {
  AUTH_TOKEN_TTL_SECONDS,
} = require('../dist/modules/auth/auth.config');

/**
 * Cada prueba proporciona su propio entorno.
 * No leemos .env ni modificamos process.env.
 */

test('getAuthCookieOptions: configura la cookie para desarrollo local', () => {
  const options = getAuthCookieOptions({
    NODE_ENV: 'development',
  });

  assert.deepEqual(options, {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    path: '/',
    maxAge: AUTH_TOKEN_TTL_SECONDS * 1_000,
  });
});

test('getAuthCookieOptions: exige HTTPS en producción', () => {
  const options = getAuthCookieOptions({
    NODE_ENV: 'production',
  });

  assert.deepEqual(options, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: AUTH_TOKEN_TTL_SECONDS * 1_000,
  });
});

test('getAuthCookieOptions: permite HTTP en el entorno de pruebas', () => {
  const options = getAuthCookieOptions({
    NODE_ENV: 'test',
  });

  assert.equal(options.secure, false);
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, 'strict');
});

test('getAuthCookieOptions: rechaza un entorno ausente o desconocido', () => {
  const valoresInvalidos = [
    undefined,
    '',
    ' ',
    'produccion',
    'Production',
    'production ',
  ];

  for (const valor of valoresInvalidos) {
    assert.throws(
      () => getAuthCookieOptions({ NODE_ENV: valor }),
      {
        message:
          'Configuración de cookies inválida: NODE_ENV debe ser ' +
          'development, test o production.',
      },
    );
  }
});

test('getAuthCookieOptions: limita la cookie al host que la establece', () => {
  for (const entorno of ['development', 'test', 'production']) {
    const options = getAuthCookieOptions({
      NODE_ENV: entorno,
    });

    // Omitir Domain evita ampliar la cookie a otros subdominios.
    assert.equal(Object.hasOwn(options, 'domain'), false);
  }
});

test('getAuthCookieOptions: devuelve opciones independientes en cada llamada', () => {
  const entorno = { NODE_ENV: 'production' };

  const primerasOpciones = getAuthCookieOptions(entorno);

  // Simula una modificación accidental por parte de un consumidor.
  primerasOpciones.httpOnly = false;
  primerasOpciones.secure = false;

  const nuevasOpciones = getAuthCookieOptions(entorno);

  assert.notStrictEqual(primerasOpciones, nuevasOpciones);
  assert.equal(nuevasOpciones.httpOnly, true);
  assert.equal(nuevasOpciones.secure, true);

  // La función tampoco debe modificar el entorno recibido.
  assert.deepEqual(entorno, { NODE_ENV: 'production' });
});