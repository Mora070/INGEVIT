const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getCorreoTrabajadorConfig,
} = require(
  '../dist/modules/notificaciones/correos/correo-trabajador.config'
);

test('trabajador correo: permanece deshabilitado por defecto', () => {
  assert.deepEqual(getCorreoTrabajadorConfig({}), {
    habilitado: false,
    intervaloMs: 5000,
    maxPorCiclo: 10,
  });
});

test('trabajador correo: admite una configuración explícita', () => {
  const env = Object.freeze({
    CORREO_TRABAJADOR_HABILITADO: 'true',
    CORREO_TRABAJADOR_INTERVALO_MS: '1000',
    CORREO_TRABAJADOR_MAX_POR_CICLO: '3',
  });

  assert.deepEqual(getCorreoTrabajadorConfig(env), {
    habilitado: true,
    intervaloMs: 1000,
    maxPorCiclo: 3,
  });
});

test('trabajador correo: rechaza valores ambiguos de habilitación', () => {
  for (const valor of ['', 'TRUE', '1', 'sí', 'false\n']) {
    assert.throws(
      () => getCorreoTrabajadorConfig({
        CORREO_TRABAJADOR_HABILITADO: valor,
      }),
      /CORREO_TRABAJADOR_HABILITADO/,
    );
  }
});

test('trabajador correo: valida el intervalo incluso estando deshabilitado', () => {
  for (const valor of [
    '', '999', '300001', '-1', '1000.5', '1e3', '1000\n', ' 1000',
  ]) {
    assert.throws(
      () => getCorreoTrabajadorConfig({
        CORREO_TRABAJADOR_HABILITADO: 'false',
        CORREO_TRABAJADOR_INTERVALO_MS: valor,
      }),
      /CORREO_TRABAJADOR_INTERVALO_MS/,
    );
  }
});

test('trabajador correo: valida el máximo de mensajes por ciclo', () => {
  for (const valor of ['', '0', '101', '1.5', '10\n', 'NaN']) {
    assert.throws(
      () => getCorreoTrabajadorConfig({
        CORREO_TRABAJADOR_MAX_POR_CICLO: valor,
      }),
      /CORREO_TRABAJADOR_MAX_POR_CICLO/,
    );
  }
});