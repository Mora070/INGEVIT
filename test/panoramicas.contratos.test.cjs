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
  });

  assert.deepEqual(fila, copia);
});

test('SubirPanoramicaDto: acepta el título y construye el DTO', async () => {
  const resultado = await validar({ titulo: 'Sector norte' });

  assert.ok(resultado instanceof SubirPanoramicaDto);
  assert.deepEqual({ ...resultado }, { titulo: 'Sector norte' });
});

test('SubirPanoramicaDto: rechaza títulos ausentes, vacíos o de otro tipo', async () => {
  for (const datos of [
    {},
    { titulo: '' },
    { titulo: null },
    { titulo: 123 },
  ]) {
    await assert.rejects(
      validar(datos),
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
      validar({ titulo: 'Sector norte', ...extra }),
      (error) => error.getStatus() === 400,
    );
  }
});