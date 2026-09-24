const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  mapearIncidenciaMapa,
} = require('../dist/modules/incidencias/mappers/incidencia-mapa.mapper');

function crearRegistro(cambios = {}) {
  return {
    id_incidencia: 'incidencia',
    id_proyecto: 'proyecto',
    id_creador: 'creador',
    titulo: 'Fisura en el acceso',
    descripcion: 'Revisar el punto señalado.',
    estado: 'PENDIENTE',
    prioridad: 'ALTA',
    id_plano: null,
    numero_pagina: null,
    coordenada_x: null,
    coordenada_y: null,
    latitud: '4.7110',
    longitud: '-74.0721',
    fecha_creacion: new Date('2026-09-22T12:00:00.000Z'),
    ...cambios,
  };
}

test('mapearIncidenciaMapa: devuelve exclusivamente los campos públicos', () => {
  const resultado = mapearIncidenciaMapa(crearRegistro({
    dato_interno: 'NO_PUBLICAR',
  }));

  assert.deepEqual(resultado, {
    id_incidencia: 'incidencia',
    id_proyecto: 'proyecto',
    id_plano: null,
    id_creador: 'creador',
    titulo: 'Fisura en el acceso',
    descripcion: 'Revisar el punto señalado.',
    estado: 'PENDIENTE',
    prioridad: 'ALTA',
    numero_pagina: null,
    coordenada_x: null,
    coordenada_y: null,
    latitud: 4.711,
    longitud: -74.0721,
    fecha_creacion: '2026-09-22T12:00:00.000Z',
  });
});

test('mapearIncidenciaMapa: no modifica el registro recibido', () => {
  const registro = crearRegistro();
  const copia = {
    ...registro,
    fecha_creacion: new Date(registro.fecha_creacion.getTime()),
  };

  const resultado = mapearIncidenciaMapa(registro);
  resultado.titulo = 'Otro título';

  assert.deepEqual(registro, copia);
});

test('mapearIncidenciaMapa: conserva cero y acepta los límites', () => {
  for (const [latitud, longitud] of [
    [0, 0],
    [-90, -180],
    [90, 180],
  ]) {
    const resultado = mapearIncidenciaMapa(crearRegistro({
      latitud: String(latitud),
      longitud: String(longitud),
    }));

    assert.equal(resultado.latitud, latitud);
    assert.equal(resultado.longitud, longitud);
  }
});

test('mapearIncidenciaMapa: rechaza coordenadas ausentes o inválidas', () => {
  for (const campo of ['latitud', 'longitud']) {
    for (const valor of [
      null,
      undefined,
      '',
      ' ',
      'NaN',
      'Infinity',
      '0x10',
      'texto',
      '1e999',
    ]) {
      assert.throws(
        () => mapearIncidenciaMapa(crearRegistro({
          [campo]: valor,
        })),
        /ubicación inválida/,
      );
    }
  }

  for (const cambios of [
    { latitud: '-90.0001' },
    { latitud: '90.0001' },
    { longitud: '-180.0001' },
    { longitud: '180.0001' },
  ]) {
    assert.throws(
      () => mapearIncidenciaMapa(crearRegistro(cambios)),
      /ubicación inválida/,
    );
  }
});

test('mapearIncidenciaMapa: rechaza contexto de plano y columnas omitidas', () => {
  for (const [campo, valor] of [
    ['id_plano', 'plano'],
    ['numero_pagina', 1],
    ['coordenada_x', '0'],
    ['coordenada_y', '0'],
  ]) {
    for (const contenido of [valor, undefined]) {
      assert.throws(
        () => mapearIncidenciaMapa(crearRegistro({
          [campo]: contenido,
        })),
        /contexto de plano inesperado/,
      );
    }
  }
});

test('mapearIncidenciaMapa: conserva el instante en UTC y rechaza fechas inválidas', () => {
  const resultado = mapearIncidenciaMapa(crearRegistro({
    fecha_creacion: new Date('2026-09-22T07:00:00.123-05:00'),
  }));

  assert.equal(
    resultado.fecha_creacion,
    '2026-09-22T12:00:00.123Z',
  );

  assert.throws(
    () => mapearIncidenciaMapa(crearRegistro({
      fecha_creacion: new Date(NaN),
    })),
    RangeError,
  );
});