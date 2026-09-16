require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  CrearIncidenciaDto,
} = require('../dist/modules/incidencias/dto/crear-incidencia.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

function entrada(cambios = {}) {
  return {
    titulo: 'Fisura en muro',
    descripcion: 'Revisar el punto señalado.',
    prioridad: 'MEDIA',
    numero_pagina: 2,
    coordenada_x: 120.5,
    coordenada_y: 80.25,
    ...cambios,
  };
}

async function validar(datos) {
  return createValidationPipe().transform(datos, {
    type: 'body',
    metatype: CrearIncidenciaDto,
  });
}

test('CrearIncidenciaDto: admite las prioridades y conserva los datos válidos', async () => {
  for (const prioridad of ['BAJA', 'MEDIA', 'ALTA']) {
    const datos = entrada({ prioridad });
    const resultado = await validar(datos);

    assert.ok(resultado instanceof CrearIncidenciaDto);
    assert.deepEqual({ ...resultado }, datos);
  }
});

const casosInvalidos = [
  ['título vacío', { titulo: '' }],
  ['descripción ausente', { descripcion: undefined }],
  ['prioridad desconocida', { prioridad: 'URGENTE' }],
  ['página cero', { numero_pagina: 0 }],
  ['página decimal', { numero_pagina: 1.5 }],
  ['página como texto', { numero_pagina: '2' }],
  ['página fuera del rango integer', { numero_pagina: 2147483648 }],
  ['coordenada X infinita', { coordenada_x: Infinity }],
  ['coordenada Y no numérica', { coordenada_y: NaN }],
  ['coordenada como texto', { coordenada_x: '120.5' }],
  ['creador proporcionado por el cliente', {
    id_creador: '10000000-0000-4000-8000-000000000001',
  }],
  ['estado proporcionado por el cliente', {
    estado: 'SOLUCIONADA',
  }],
];

for (const [nombre, cambios] of casosInvalidos) {
  test(`CrearIncidenciaDto: rechaza ${nombre}`, async () => {
    await assert.rejects(
      validar(entrada(cambios)),
      (error) => {
        assert.equal(error.getStatus(), 400);
        return true;
      },
    );
  });
}