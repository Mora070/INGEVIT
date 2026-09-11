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