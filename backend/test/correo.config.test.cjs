const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getCorreoConfig,
} = require('../dist/modules/correos/correo.config');

function entorno(cambios = {}) {
  return {
    NODE_ENV: 'development',
    CORREO_PROVEEDOR: 'mailpit',
    CORREO_SMTP_HOST: '127.0.0.1',
    CORREO_SMTP_PORT: '1025',
    CORREO_REMITENTE_NOMBRE: 'INGEVIT Desarrollo',
    CORREO_REMITENTE_DIRECCION: 'notificaciones@ingevit.test',
    ...cambios,
  };
}

test('correo: obtiene la configuración local sin modificar el entorno', () => {
  const env = Object.freeze(entorno());

  assert.deepEqual(getCorreoConfig(env), {
    host: '127.0.0.1',
    port: 1025,
    remitente: {
      name: 'INGEVIT Desarrollo',
      address: 'notificaciones@ingevit.test',
    },
  });
});

test('correo: permite el entorno de pruebas', () => {
  assert.doesNotThrow(() =>
    getCorreoConfig(entorno({ NODE_ENV: 'test' })),
  );
});

test('correo: rechaza producción y entornos no declarados', () => {
  for (const valor of ['production', '', undefined]) {
    assert.throws(
      () => getCorreoConfig(entorno({ NODE_ENV: valor })),
      /NODE_ENV/,
    );
  }
});

test('correo: rechaza proveedores no implementados', () => {
  assert.throws(
    () => getCorreoConfig(entorno({ CORREO_PROVEEDOR: 'otro' })),
    /CORREO_PROVEEDOR/,
  );
});

test('correo: impide utilizar Mailpit fuera de loopback', () => {
  assert.throws(
    () => getCorreoConfig(entorno({
      CORREO_SMTP_HOST: 'smtp.example.com',
    })),
    /CORREO_SMTP_HOST/,
  );
});

test('correo: rechaza puertos ausentes o inválidos', () => {
  for (const port of [
    undefined, '', '0', '65536', '-1', '1.5', '1025abc', '1025\n',
  ]) {
    assert.throws(
      () => getCorreoConfig(entorno({ CORREO_SMTP_PORT: port })),
      /CORREO_SMTP_PORT/,
    );
  }
});

test('correo: rechaza un nombre vacío o con saltos de línea', () => {
  for (const nombre of ['', '   ', 'INGEVIT\r\nBcc: otro@test.com']) {
    assert.throws(
      () => getCorreoConfig(entorno({
        CORREO_REMITENTE_NOMBRE: nombre,
      })),
      /CORREO_REMITENTE_NOMBRE/,
    );
  }
});

test('correo: rechaza direcciones de remitente inválidas', () => {
  for (const direccion of [
    '',
    'incorrecto',
    ' notificaciones@ingevit.test',
    'notificaciones@ingevit.test\r\n',
  ]) {
    assert.throws(
      () => getCorreoConfig(entorno({
        CORREO_REMITENTE_DIRECCION: direccion,
      })),
      /CORREO_REMITENTE_DIRECCION/,
    );
  }
});