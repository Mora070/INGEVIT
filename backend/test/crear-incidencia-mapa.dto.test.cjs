require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');

const {
  CrearIncidenciaMapaDto,
} = require('../dist/modules/incidencias/dto/crear-incidencia-mapa.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

function entrada(cambios = {}) {
  return {
    titulo: 'Fisura en el acceso',
    descripcion: 'Revisar el sector señalado en el mapa.',
    prioridad: 'ALTA',
    latitud: 4.711,
    longitud: -74.0721,
    ...cambios,
  };
}

function validar(body) {
  return createValidationPipe().transform(body, {
    type: 'body',
    metatype: CrearIncidenciaMapaDto,
    data: undefined,
  });
}

function esSolicitudInvalida(error) {
  assert.ok(error instanceof BadRequestException);
  assert.equal(error.getStatus(), 400);
  return true;
}

test('CrearIncidenciaMapaDto: acepta datos válidos sin modificarlos', async () => {
  for (const prioridad of ['BAJA', 'MEDIA', 'ALTA']) {
    const datos = entrada({ prioridad });
    const copia = { ...datos };

    const resultado = await validar(datos);

    assert.ok(resultado instanceof CrearIncidenciaMapaDto);
    assert.deepEqual({ ...resultado }, copia);
    assert.deepEqual(datos, copia);
  }
});

test('CrearIncidenciaMapaDto: exige ambas coordenadas', async () => {
  for (const campo of ['latitud', 'longitud']) {
    const datos = entrada();
    delete datos[campo];

    await assert.rejects(validar(datos), esSolicitudInvalida);

    await assert.rejects(
      validar(entrada({ [campo]: null })),
      esSolicitudInvalida,
    );
  }
});

test('CrearIncidenciaMapaDto: acepta cero y límites, y rechaza valores fuera de rango', async () => {
  for (const [latitud, longitud] of [
    [0, 0],
    [-90, -180],
    [90, 180],
  ]) {
    const resultado = await validar(entrada({ latitud, longitud }));

    assert.equal(resultado.latitud, latitud);
    assert.equal(resultado.longitud, longitud);
  }

  for (const cambios of [
    { latitud: -90.0001 },
    { latitud: 90.0001 },
    { longitud: -180.0001 },
    { longitud: 180.0001 },
  ]) {
    await assert.rejects(
      validar(entrada(cambios)),
      esSolicitudInvalida,
    );
  }
});

test('CrearIncidenciaMapaDto: exige números JSON finitos', async () => {
  for (const campo of ['latitud', 'longitud']) {
    for (const valor of [
      '4.711',
      '0',
      '',
      true,
      false,
      [],
      {},
      NaN,
      Infinity,
      -Infinity,
    ]) {
      await assert.rejects(
        validar(entrada({ [campo]: valor })),
        esSolicitudInvalida,
      );
    }
  }
});

test('CrearIncidenciaMapaDto: rechaza campos de plano incluso cuando son null', async () => {
  for (const [campo, valor] of [
    ['id_plano', '20000000-0000-4000-8000-000000000001'],
    ['numero_pagina', 1],
    ['coordenada_x', 0],
    ['coordenada_y', 0],
  ]) {
    for (const contenido of [valor, null]) {
      await assert.rejects(
        validar(entrada({ [campo]: contenido })),
        esSolicitudInvalida,
      );
    }
  }
});

test('CrearIncidenciaMapaDto: rechaza campos controlados por el backend', async () => {
  for (const campo of [
    'id_incidencia',
    'id_proyecto',
    'id_creador',
    'estado',
    'fecha_creacion',
  ]) {
    await assert.rejects(
      validar(entrada({ [campo]: 'valor-no-permitido' })),
      esSolicitudInvalida,
    );
  }
});

test('CrearIncidenciaMapaDto: valida título, descripción y prioridad', async () => {
  for (const campo of ['titulo', 'descripcion', 'prioridad']) {
    const datos = entrada();
    delete datos[campo];

    await assert.rejects(validar(datos), esSolicitudInvalida);

    for (const valor of ['', null, 123]) {
      await assert.rejects(
        validar(entrada({ [campo]: valor })),
        esSolicitudInvalida,
      );
    }
  }

  await assert.rejects(
    validar(entrada({ prioridad: 'URGENTE' })),
    esSolicitudInvalida,
  );
});