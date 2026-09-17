require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { ServiceUnavailableException } = require('@nestjs/common');

const {
  GoogleIdentidadService,
} = require('../dist/modules/auth/services/google-identidad.service');

const CLIENT_ID = '123456789-pruebas.apps.googleusercontent.com';

const PAYLOAD = {
  sub: 'google-identidad-prueba',
  email: 'persona@example.invalid',
  email_verified: true,
  given_name: ' Ana ',
  family_name: ' Pérez ',
};

function crearServicio(verificador) {
  const anterior = process.env.AUTH_GOOGLE_CLIENT_ID;

  try {
    process.env.AUTH_GOOGLE_CLIENT_ID = CLIENT_ID;
    return new GoogleIdentidadService(verificador);
  } finally {
    if (anterior === undefined) {
      delete process.env.AUTH_GOOGLE_CLIENT_ID;
    } else {
      process.env.AUTH_GOOGLE_CLIENT_ID = anterior;
    }
  }
}

test('Google identidad: verifica para el cliente configurado y selecciona los datos permitidos', async () => {
  const servicio = crearServicio({
    async verificar(credential, clientId) {
      assert.equal(credential, 'credencial-simulada');
      assert.equal(clientId, CLIENT_ID);

      return {
        ...PAYLOAD,
        picture: 'https://example.invalid/avatar.jpg',
        rol: 'ADMINISTRADOR',
      };
    },
  });

  assert.deepEqual(
    await servicio.verificar('credencial-simulada'),
    {
      sub: PAYLOAD.sub,
      correo: PAYLOAD.email,
      nombre: 'Ana',
      apellidos: 'Pérez',
    },
  );
});

test('Google identidad: rechaza datos incompletos y correos no verificados', async () => {
  for (const payload of [
    undefined,
    { ...PAYLOAD, sub: '' },
    { ...PAYLOAD, sub: 'a'.repeat(256) },
    { ...PAYLOAD, email_verified: false },
    { ...PAYLOAD, email_verified: undefined },
    { ...PAYLOAD, email: 'correo-invalido' },
    { ...PAYLOAD, email: ' persona@example.invalid ' },
  ]) {
    const servicio = crearServicio({
      async verificar() {
        return payload;
      },
    });

    await assert.rejects(
      () => servicio.verificar('credencial-simulada'),
      (error) => error.getStatus?.() === 401,
    );
  }
});

test('Google identidad: conserva los errores del proveedor sin convertirlos en identidad inválida', async () => {
  const esperado = new ServiceUnavailableException(
    'Proveedor no disponible',
  );

  const servicio = crearServicio({
    async verificar() {
      throw esperado;
    },
  });

  await assert.rejects(
    () => servicio.verificar('credencial-simulada'),
    (error) => error === esperado && error.getStatus() === 503,
  );
});

test('Google identidad: rechaza entradas inválidas antes de consultar el proveedor', async () => {
  let consultas = 0;

  const servicio = crearServicio({
    async verificar() {
      consultas += 1;
      return PAYLOAD;
    },
  });

  for (const valor of [undefined, null, 123, '', 'a'.repeat(16385)]) {
    await assert.rejects(
      () => servicio.verificar(valor),
      (error) => error.getStatus?.() === 401,
    );
  }

  assert.equal(consultas, 0);
});