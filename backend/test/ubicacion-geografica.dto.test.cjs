require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');

const {
  UbicacionGeograficaDto,
} = require('../dist/common/dto/ubicacion-geografica.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

function validar(body) {
  return createValidationPipe().transform(body, {
    type: 'body',
    metatype: UbicacionGeograficaDto,
    data: undefined,
  });
}

function esSolicitudInvalida(error) {
  assert.ok(error instanceof BadRequestException);
  assert.equal(error.getStatus(), 400);
  return true;
}

test('UbicacionGeograficaDto: convierte coordenadas multipart sin modificar la entrada', async () => {
  const entrada = {
    latitud: ' 4.7110 ',
    longitud: ' -74.0721 ',
  };

  const resultado = await validar(entrada);

  assert.ok(resultado instanceof UbicacionGeograficaDto);
  assert.equal(resultado.latitud, 4.711);
  assert.equal(resultado.longitud, -74.0721);
  assert.deepEqual(entrada, {
    latitud: ' 4.7110 ',
    longitud: ' -74.0721 ',
  });
});

test('UbicacionGeograficaDto: acepta coordenadas numéricas', async () => {
  const resultado = await validar({
    latitud: 4.711,
    longitud: -74.0721,
  });

  assert.equal(resultado.latitud, 4.711);
  assert.equal(resultado.longitud, -74.0721);
});

test('UbicacionGeograficaDto: acepta cero y los límites geográficos', async () => {
  for (const [latitud, longitud] of [
    [0, 0],
    [-90, -180],
    [90, 180],
  ]) {
    const resultado = await validar({
      latitud: String(latitud),
      longitud: String(longitud),
    });

    assert.equal(resultado.latitud, latitud);
    assert.equal(resultado.longitud, longitud);
  }
});

test('UbicacionGeograficaDto: acepta notación científica finita', async () => {
  const resultado = await validar({
    latitud: '1e-7',
    longitud: '-2E-7',
  });

  assert.equal(resultado.latitud, 1e-7);
  assert.equal(resultado.longitud, -2e-7);
});

test('UbicacionGeograficaDto: exige ambas coordenadas', async () => {
  for (const entrada of [
    {},
    { latitud: 4 },
    { longitud: -74 },
    { latitud: null, longitud: -74 },
    { latitud: 4, longitud: null },
  ]) {
    await assert.rejects(validar(entrada), esSolicitudInvalida);
  }
});

test('UbicacionGeograficaDto: rechaza tipos y representaciones inválidas en ambos campos', async () => {
  const invalidos = [
    '',
    '   ',
    true,
    false,
    [],
    ['4'],
    {},
    '4,711',
    '4 grados',
    '0x10',
    'NaN',
    'Infinity',
    '1e999',
    NaN,
    Infinity,
    -Infinity,
  ];

  for (const campo of ['latitud', 'longitud']) {
    for (const valor of invalidos) {
      await assert.rejects(
        validar({
          latitud: 4,
          longitud: -74,
          [campo]: valor,
        }),
        esSolicitudInvalida,
      );
    }
  }
});

test('UbicacionGeograficaDto: rechaza coordenadas fuera de rango', async () => {
  for (const entrada of [
    { latitud: -90.0001, longitud: 0 },
    { latitud: 90.0001, longitud: 0 },
    { latitud: 0, longitud: -180.0001 },
    { latitud: 0, longitud: 180.0001 },
  ]) {
    await assert.rejects(validar(entrada), esSolicitudInvalida);
  }
});

test('UbicacionGeograficaDto: rechaza propiedades ajenas al contrato', async () => {
  await assert.rejects(
    validar({
      latitud: 4,
      longitud: -74,
      id_usuario: 'identidad-no-permitida',
    }),
    esSolicitudInvalida,
  );
});