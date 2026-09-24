require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mapearFotografia,
} = require('../dist/modules/fotografias/mappers/fotografia.mapper');

function crearFotografia(cambios = {}) {
  return {
    id_fotografia: '50000000-0000-4000-8000-000000000005',
    id_proyecto: '20000000-0000-4000-8000-000000000002',
    id_usuario_subida: '10000000-0000-4000-8000-000000000001',
    titulo: 'Fotografía de prueba',
    url: 'https://example.invalid/fotografia.jpg',
    s3_key: 'fotografias/archivo-de-prueba.jpg',
    original_s3_key:
  'fotografias/60000000-0000-4000-8000-000000000006.jpg',
    fecha_subida: new Date('2026-09-10T15:30:00.000Z'),
    latitud: null,
    longitud: null,
    ...cambios,
  };
}

test(
  'mapearFotografia: devuelve únicamente los campos públicos y conserva al usuario de subida',
  () => {
    const fotografia = crearFotografia({
      dato_interno: 'NO_PUBLICABLE',
    });

    const resultado = mapearFotografia(fotografia);

    assert.deepEqual(resultado, {
      id_fotografia: '50000000-0000-4000-8000-000000000005',
      id_proyecto: '20000000-0000-4000-8000-000000000002',
      id_usuario_subida: '10000000-0000-4000-8000-000000000001',
      titulo: 'Fotografía de prueba',
      url: 'https://example.invalid/fotografia.jpg',
      latitud: null,
      longitud: null,
      fecha_subida: '2026-09-10T15:30:00.000Z',
    });

    assert.equal(Object.hasOwn(resultado, 's3_key'), false);
    assert.equal(Object.hasOwn(resultado, 'original_s3_key'),false,);
    assert.equal(Object.hasOwn(resultado, 'dato_interno'), false);
  },
);

test(
  'mapearFotografia: convierte la fecha a UTC conservando el instante y los milisegundos',
  () => {
    const fotografia = crearFotografia({
      fecha_subida: new Date('2026-09-10T10:30:00.123-05:00'),
    });

    const resultado = mapearFotografia(fotografia);

    assert.equal(
      resultado.fecha_subida,
      '2026-09-10T15:30:00.123Z',
    );
  },
);

test(
  'mapearFotografia: crea un objeto nuevo sin modificar el registro original',
  () => {
    const fotografia = crearFotografia();
    const copiaAnterior = {
      ...fotografia,
      fecha_subida: new Date(fotografia.fecha_subida.getTime()),
    };

    const resultado = mapearFotografia(fotografia);

    assert.notStrictEqual(resultado, fotografia);
    assert.deepEqual(fotografia, copiaAnterior);
    assert.ok(fotografia.fecha_subida instanceof Date);

    // Modificar la respuesta no debe modificar el registro recibido.
    resultado.titulo = 'Título modificado en la respuesta';

    assert.deepEqual(fotografia, copiaAnterior);
  },
);

test(
  'mapearFotografia: rechaza una fecha inválida',
  () => {
    const fotografia = crearFotografia({
      fecha_subida: new Date(Number.NaN),
    });

    assert.throws(
      () => mapearFotografia(fotografia),
      RangeError,
    );
  },
);

test('mapearFotografia: convierte las coordenadas a números', () => {
  const fotografia = crearFotografia({
    latitud: '4.7110',
    longitud: '-74.0721',
  });

  const resultado = mapearFotografia(fotografia);

  assert.equal(resultado.latitud, 4.711);
  assert.equal(resultado.longitud, -74.0721);

  // La conversión no modifica los valores recibidos de PostgreSQL.
  assert.equal(fotografia.latitud, '4.7110');
  assert.equal(fotografia.longitud, '-74.0721');
});

test('mapearFotografia: conserva una ubicación antigua ausente', () => {
  const resultado = mapearFotografia(crearFotografia({
    latitud: null,
    longitud: null,
  }));

  assert.equal(resultado.latitud, null);
  assert.equal(resultado.longitud, null);
});

test('mapearFotografia: conserva cero y acepta los límites', () => {
  for (const [latitud, longitud] of [
    [0, 0],
    [-90, -180],
    [90, 180],
  ]) {
    const resultado = mapearFotografia(crearFotografia({
      latitud: String(latitud),
      longitud: String(longitud),
    }));

    assert.equal(resultado.latitud, latitud);
    assert.equal(resultado.longitud, longitud);
  }
});

test('mapearFotografia: rechaza coordenadas incompletas u omitidas', () => {
  for (const cambios of [
    { latitud: null, longitud: '-74' },
    { latitud: '4', longitud: null },
    { latitud: undefined, longitud: undefined },
    { latitud: undefined, longitud: null },
  ]) {
    assert.throws(
      () => mapearFotografia(crearFotografia(cambios)),
      /ubicación/,
    );
  }
});

test('mapearFotografia: rechaza valores inválidos y fuera de rango', () => {
  for (const cambios of [
    { latitud: '', longitud: '0' },
    { latitud: ' ', longitud: '0' },
    { latitud: 'NaN', longitud: '0' },
    { latitud: 'Infinity', longitud: '0' },
    { latitud: '0x10', longitud: '0' },
    { latitud: '91', longitud: '0' },
    { latitud: '-91', longitud: '0' },
    { latitud: '0', longitud: '181' },
    { latitud: '0', longitud: '-181' },
    { latitud: '0', longitud: 'texto' },
  ]) {
    assert.throws(
      () => mapearFotografia(crearFotografia(cambios)),
      /ubicación/,
    );
  }
});