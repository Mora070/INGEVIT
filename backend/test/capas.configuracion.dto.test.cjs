require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');

const {
  ActualizarConfiguracionCapaDto,
} = require('../dist/modules/capas/dto/actualizar-configuracion-capa.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

function entrada(cambios = {}) {
  return {
    opacidad: 0.65,
    visible: true,
    orden: 2,
    ...cambios,
  };
}

function validar(datos) {
  return createValidationPipe().transform(datos, {
    type: 'body',
    metatype: ActualizarConfiguracionCapaDto,
  });
}

function esSolicitudInvalida(error) {
  assert.ok(error instanceof BadRequestException);
  assert.equal(error.getStatus(), 400);
  return true;
}

test('configuración de capa: acepta valores válidos sin modificar la entrada', async () => {
  for (const datos of [
    entrada(),
    entrada({ opacidad: 0, visible: false, orden: 0 }),
    entrada({ opacidad: 1, orden: 2147483647 }),
  ]) {
    const copia = { ...datos };
    const resultado = await validar(datos);

    assert.ok(resultado instanceof ActualizarConfiguracionCapaDto);
    assert.deepEqual({ ...resultado }, copia);
    assert.deepEqual(datos, copia);
  }
});

test('configuración de capa: exige los tres campos', async () => {
  for (const campo of ['opacidad', 'visible', 'orden']) {
    const datos = entrada();
    delete datos[campo];

    await assert.rejects(validar(datos), esSolicitudInvalida);

    await assert.rejects(
      validar(entrada({ [campo]: null })),
      esSolicitudInvalida,
    );
  }
});

test('configuración de capa: rechaza opacidad inválida', async () => {
  for (const opacidad of [
    -0.01,
    1.01,
    NaN,
    Infinity,
    -Infinity,
    '0.65',
    '',
    true,
    [],
    {},
  ]) {
    await assert.rejects(
      validar(entrada({ opacidad })),
      esSolicitudInvalida,
    );
  }
});

test('configuración de capa: exige booleanos reales para visible', async () => {
  for (const visible of [
    'true',
    'false',
    0,
    1,
    '',
    [],
    {},
  ]) {
    await assert.rejects(
      validar(entrada({ visible })),
      esSolicitudInvalida,
    );
  }
});

test('configuración de capa: exige orden entero dentro del rango', async () => {
  for (const orden of [
    -1,
    0.5,
    2147483648,
    NaN,
    Infinity,
    '2',
    true,
    [],
    {},
  ]) {
    await assert.rejects(
      validar(entrada({ orden })),
      esSolicitudInvalida,
    );
  }
});

test('configuración de capa: rechaza campos ajenos a la presentación', async () => {
  for (const extra of [
    { id_proyecto: 'otro-proyecto' },
    { id_usuario_subida: 'otro-usuario' },
    { original_key: 'capas/otro.tif' },
    { almacenamiento_proveedor: 'S3' },
    { tamano_original_bytes: '1024' },
    { crs_original: 'EPSG:4326' },
    { bbox: [-74.1, 4.6, -74, 4.7] },
    { estado_procesamiento: 'LISTA' },
    { mapbox_source_id: 'fuente' },
    { mapbox_tileset_id: 'cuenta.tileset' },
    { mapbox_job_id: 'trabajo' },
    { error_procesamiento: 'error' },
  ]) {
    await assert.rejects(
      validar({ ...entrada(), ...extra }),
      esSolicitudInvalida,
    );
  }
});