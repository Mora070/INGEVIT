require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');

const {
  ActualizarTituloFotografiaDto,
} = require('../dist/modules/fotografias/dto/actualizar-titulo-fotografia.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

/**
 * Aplica la configuración real de validación del backend.
 * No necesitamos iniciar un servidor para comprobar el DTO.
 */
async function validar(entrada) {
  const pipe = createValidationPipe();

  return pipe.transform(entrada, {
    type: 'body',
    metatype: ActualizarTituloFotografiaDto,
  });
}

test(
  'ActualizarTituloFotografiaDto: acepta el título y construye el DTO',
  async () => {
    const resultado = await validar({
      titulo: 'Avance de cimentación',
    });

    assert.ok(resultado instanceof ActualizarTituloFotografiaDto);
    assert.equal(resultado.titulo, 'Avance de cimentación');
    assert.deepEqual(Object.keys(resultado), ['titulo']);
  },
);

test(
  'ActualizarTituloFotografiaDto: conserva los espacios del título',
  async () => {
    const titulo = '  Avance de cimentación  ';

    const resultado = await validar({ titulo });

    assert.equal(resultado.titulo, titulo);
  },
);

const casosInvalidos = [
  ['título ausente', {}],
  ['título vacío', { titulo: '' }],
  ['título nulo', { titulo: null }],
  ['título numérico', { titulo: 123 }],
  [
    'URL adicional',
    {
      titulo: 'Avance de obra',
      url: '/otra-fotografia.webp',
    },
  ],
  [
    'identidad adicional',
    {
      titulo: 'Avance de obra',
      id_usuario_subida: '10000000-0000-4000-8000-000000000001',
    },
  ],
];

for (const [descripcion, entrada] of casosInvalidos) {
  test(
    `ActualizarTituloFotografiaDto: rechaza ${descripcion}`,
    async () => {
      await assert.rejects(
        () => validar(entrada),
        (error) => {
          assert.ok(error instanceof BadRequestException);
          assert.equal(error.getStatus(), 400);
          return true;
        },
      );
    },
  );
}