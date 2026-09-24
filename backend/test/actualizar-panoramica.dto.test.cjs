require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  ActualizarPanoramicaDto,
} = require('../dist/modules/panoramicas/dto/actualizar-panoramica.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

function validar(body) {
  return createValidationPipe().transform(body, {
    type: 'body',
    metatype: ActualizarPanoramicaDto,
    data: undefined,
  });
}

test('ActualizarPanoramicaDto: permite editar el título sin coordenadas', async () => {
  const resultado = await validar({
    titulo: 'Sector norte actualizado',
  });

  assert.ok(resultado instanceof ActualizarPanoramicaDto);
  assert.deepEqual({ ...resultado }, {
    titulo: 'Sector norte actualizado',
  });
});

test('ActualizarPanoramicaDto: rechaza coordenadas en la edición del título', async () => {
  for (const campo of ['latitud', 'longitud']) {
    await assert.rejects(
      validar({
        titulo: 'Sector norte actualizado',
        [campo]: 0,
      }),
      (error) => error.getStatus() === 400,
    );
  }
});

test('ActualizarPanoramicaDto: mantiene la validación del título', async () => {
  for (const entrada of [
    {},
    { titulo: '' },
    { titulo: null },
    { titulo: 123 },
  ]) {
    await assert.rejects(
      validar(entrada),
      (error) => error.getStatus() === 400,
    );
  }
});