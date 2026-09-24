require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  mapearPanoramica,
} = require('../dist/modules/panoramicas/mappers/panoramica.mapper');

const {
  SubirPanoramicaDto,
} = require('../dist/modules/panoramicas/dto/subir-panoramica.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

function validar(datos) {
  return createValidationPipe().transform(datos, {
    type: 'body',
    metatype: SubirPanoramicaDto,
  });
}

test('PanoramicaMapper: devuelve campos públicos sin modificar el registro', () => {
  const fila = {
    id_panoramica: 'panoramica',
    id_proyecto: 'proyecto',
    id_usuario_subida: 'usuario',
    titulo: 'Sector norte',
    url: '/panoramica.webp',
    s3_key: 'panoramicas/clave-interna.webp',
    mime_type: 'image/webp',
    fecha_subida: new Date('2026-09-15T12:00:00.000Z'),
    dato_interno: 'no publicar',
    latitud: null,
    longitud: null,
  };
  const copia = { ...fila };

  assert.deepEqual(mapearPanoramica(fila), {
    id_panoramica: 'panoramica',
    id_proyecto: 'proyecto',
    id_usuario_subida: 'usuario',
    titulo: 'Sector norte',
    url: '/panoramica.webp',
    mime_type: 'image/webp',
    fecha_subida: '2026-09-15T12:00:00.000Z',
    latitud: null,
    longitud: null,
  });

  assert.deepEqual(fila, copia);
});

test('SubirPanoramicaDto: acepta el título y construye el DTO', async () => {
  const resultado = await validar({
    titulo: 'Sector norte',
    latitud: 4.711,
    longitud: -74.0721,
  });

  assert.ok(resultado instanceof SubirPanoramicaDto);

  assert.deepEqual(
    { ...resultado },
    {
      titulo: 'Sector norte',
      latitud: 4.711,
      longitud: -74.0721,
    },
  );
});

test('SubirPanoramicaDto: rechaza títulos ausentes, vacíos o de otro tipo', async () => {
  for (const datos of [
    {},
    { titulo: '' },
    { titulo: null },
    { titulo: 123 },
  ]) {
    await assert.rejects(
      validar({
        latitud: 4.711,
        longitud: -74.0721,
        ...datos,
      }),
      (error) => error.getStatus() === 400,
    );
  }
});

test('SubirPanoramicaDto: rechaza campos controlados por el backend', async () => {
  for (const extra of [
    { id_usuario_subida: 'otro' },
    { id_proyecto: 'otro' },
    { url: '/externa' },
    { s3_key: 'panoramicas/externa.webp' },
    { mime_type: 'image/webp' },
  ]) {
    await assert.rejects(
      validar({
        titulo: 'Sector norte',
        latitud: 4.711,
        longitud: -74.0721,
        ...extra,
      }),
      (error) => error.getStatus() === 400,
    );
  }
});

function crearPanoramicaUbicada(cambios = {}) {
  return {
    id_panoramica: 'panoramica',
    id_proyecto: 'proyecto',
    id_usuario_subida: 'usuario',
    titulo: 'Sector norte',
    url: '/panoramica.webp',
    s3_key: 'panoramicas/clave-interna.webp',
    mime_type: 'image/webp',
    fecha_subida: new Date('2026-09-15T12:00:00.000Z'),
    latitud: '4.711',
    longitud: '-74.0721',
    ...cambios,
  };
}

test('PanoramicaMapper: convierte coordenadas sin modificar el registro', () => {
  const fila = crearPanoramicaUbicada();
  const copia = { ...fila };

  const resultado = mapearPanoramica(fila);

  assert.equal(resultado.latitud, 4.711);
  assert.equal(resultado.longitud, -74.0721);
  assert.deepEqual(fila, copia);
  assert.equal(Object.hasOwn(resultado, 's3_key'), false);
});

test('PanoramicaMapper: conserva la ubicación antigua ausente', () => {
  const resultado = mapearPanoramica(crearPanoramicaUbicada({
    latitud: null,
    longitud: null,
  }));

  assert.equal(resultado.latitud, null);
  assert.equal(resultado.longitud, null);
});

test('PanoramicaMapper: acepta cero y los límites geográficos', () => {
  for (const [latitud, longitud] of [
    [0, 0],
    [-90, -180],
    [90, 180],
  ]) {
    const resultado = mapearPanoramica(crearPanoramicaUbicada({
      latitud: String(latitud),
      longitud: String(longitud),
    }));

    assert.equal(resultado.latitud, latitud);
    assert.equal(resultado.longitud, longitud);
  }
});

test('PanoramicaMapper: rechaza coordenadas incompletas u omitidas', () => {
  for (const cambios of [
    { latitud: null, longitud: '-74' },
    { latitud: '4', longitud: null },
    { latitud: undefined, longitud: undefined },
    { latitud: undefined, longitud: null },
  ]) {
    assert.throws(
      () => mapearPanoramica(crearPanoramicaUbicada(cambios)),
      /ubicación/,
    );
  }
});

test('PanoramicaMapper: rechaza formatos inválidos y valores fuera de rango', () => {
  for (const cambios of [
    { latitud: '' },
    { latitud: ' ' },
    { latitud: 'NaN' },
    { latitud: 'Infinity' },
    { latitud: '0x10' },
    { latitud: '91' },
    { latitud: '-91' },
    { longitud: '181' },
    { longitud: '-181' },
    { longitud: 'texto' },
  ]) {
    assert.throws(
      () => mapearPanoramica(crearPanoramicaUbicada(cambios)),
      /ubicación/,
    );
  }
});