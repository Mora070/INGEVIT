const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { OAuth2Client } = require('google-auth-library');

const {
  crearVerificadorGoogle,
} = require('../dist/modules/auth/google-verificador');

const CLIENT_ID = '123456789-pruebas.apps.googleusercontent.com';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

const certificado = publicKey.export({
  type: 'spki',
  format: 'pem',
});

function crearToken(cambios = {}, kid = 'clave-prueba') {
  const ahora = Math.floor(Date.now() / 1000);

  const encabezado = Buffer.from(JSON.stringify({
    alg: 'RS256',
    typ: 'JWT',
    kid,
  })).toString('base64url');

  const contenido = Buffer.from(JSON.stringify({
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: 'identidad-google-prueba',
    iat: ahora - 10,
    exp: ahora + 3600,
    email: 'persona@example.invalid',
    email_verified: true,
    ...cambios,
  })).toString('base64url');

  const datos = `${encabezado}.${contenido}`;
  const firma = sign('RSA-SHA256', Buffer.from(datos), privateKey)
    .toString('base64url');

  return `${datos}.${firma}`;
}

/**
 * Sustituye solamente la descarga de certificados.
 * La biblioteca oficial verifica realmente la firma y las claims.
 * Node restaura el método al finalizar cada prueba.
 */
function prepararCertificados(t) {
  t.mock.method(
    OAuth2Client.prototype,
    'getFederatedSignonCertsAsync',
    async () => ({
      certs: { 'clave-prueba': certificado },
      format: 'PEM',
    }),
  );
}

test('Google verificador: acepta una firma válida para el cliente y emisor esperados', async (t) => {
  prepararCertificados(t);

  const payload = await crearVerificadorGoogle().verificar(
    crearToken(),
    CLIENT_ID,
  );

  assert.equal(payload.sub, 'identidad-google-prueba');
  assert.equal(payload.email_verified, true);
});

test('Google verificador: rechaza firma manipulada, vencimiento, destinatario y emisor incorrectos', async (t) => {
  prepararCertificados(t);

  const ahora = Math.floor(Date.now() / 1000);
  const valido = crearToken();
  const segmentos = valido.split('.');

  // Cambia el contenido sin volver a firmarlo.
  segmentos[1] = Buffer.from(JSON.stringify({
    sub: 'identidad-manipulada',
  })).toString('base64url');

  const rechazados = [
    segmentos.join('.'),
    crearToken({ iat: ahora - 7200, exp: ahora - 3600 }),
    crearToken({ iat: ahora + 3600, exp: ahora + 7200 }),
    crearToken({ aud: 'otro-cliente.apps.googleusercontent.com' }),
    crearToken({ iss: 'https://proveedor-no-autorizado.invalid' }),
    crearToken({}, 'clave-desconocida'),
    'contenido-no-jwt',
  ];

  const verificador = crearVerificadorGoogle();

  for (const token of rechazados) {
    await assert.rejects(
      () => verificador.verificar(token, CLIENT_ID),
      (error) => {
        assert.equal(error.getStatus?.(), 401);
        assert.equal(
          error.message,
          'No se pudo validar la identidad de Google.',
        );
        assert.ok(!JSON.stringify(error.getResponse()).includes(token));
        return true;
      },
    );
  }
});

test('Google verificador: devuelve 503 sin exponer detalles si falla la descarga de certificados', async (t) => {
  t.mock.method(
    OAuth2Client.prototype,
    'getFederatedSignonCertsAsync',
    async () => {
      throw new Error('Detalle técnico que no debe publicarse');
    },
  );

  await assert.rejects(
    () => crearVerificadorGoogle().verificar(crearToken(), CLIENT_ID),
    (error) =>
      error.getStatus?.() === 503 &&
      error.message ===
        'No se pudo contactar con Google. Inténtalo más tarde.',
  );
});