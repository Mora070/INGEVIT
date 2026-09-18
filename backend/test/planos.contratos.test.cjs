require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');

const {
  mapearPlano,
} = require('../dist/modules/planos/mappers/plano.mapper');

const {
  SubirPlanoDto,
} = require('../dist/modules/planos/dto/subir-plano.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

function validar(entrada) {
  return createValidationPipe().transform(entrada, {
    type: 'body',
    metatype: SubirPlanoDto,
  });
}

test('mapearPlano: devuelve solo campos públicos sin modificar el registro', () => {
  const registro = Object.freeze({
    id_plano: '30000000-0000-4000-8000-000000000003',
    id_proyecto: '20000000-0000-4000-8000-000000000002',
    id_usuario_subida: '10000000-0000-4000-8000-000000000001',
    titulo: 'Plano de cimentación',
    descripcion: 'Sector norte',
    url: '/plano.pdf',
    s3_key: 'planos/40000000-0000-4000-8000-000000000004.pdf',
    mime_type: 'application/pdf',
    fecha_subida: new Date('2026-09-14T12:00:00.000Z'),
    campo_interno_futuro: 'No debe salir',
  });

  const copia = { ...registro };

  assert.deepEqual(mapearPlano(registro), {
    id_plano: registro.id_plano,
    id_proyecto: registro.id_proyecto,
    id_usuario_subida: registro.id_usuario_subida,
    titulo: 'Plano de cimentación',
    descripcion: 'Sector norte',
    url: '/plano.pdf',
    mime_type: 'application/pdf',
    fecha_subida: '2026-09-14T12:00:00.000Z',
  });

  assert.deepEqual(registro, copia);
});

test('SubirPlanoDto: acepta metadatos y construye el DTO', async () => {
  const resultado = await validar({
    titulo: 'Plano de cimentación',
    descripcion: 'Sector norte',
  });

  assert.ok(resultado instanceof SubirPlanoDto);
  assert.equal(resultado.titulo, 'Plano de cimentación');
  assert.equal(resultado.descripcion, 'Sector norte');
});

test('SubirPlanoDto: permite una descripción vacía', async () => {
  const resultado = await validar({
    titulo: 'Plano de cimentación',
    descripcion: '',
  });

  assert.equal(resultado.descripcion, '');
});

const casosInvalidos = [
  ['título ausente', { descripcion: 'Sector norte' }],
  ['título vacío', { titulo: '', descripcion: 'Sector norte' }],
  ['descripción ausente', { titulo: 'Plano' }],
  ['descripción nula', { titulo: 'Plano', descripcion: null }],
  [
    'clave de almacenamiento adicional',
    {
      titulo: 'Plano',
      descripcion: '',
      s3_key: 'planos/archivo.pdf',
    },
  ],
];

for (const [descripcion, entrada] of casosInvalidos) {
  test(`SubirPlanoDto: rechaza ${descripcion}`, async () => {
    await assert.rejects(
      () => validar(entrada),
      (error) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(error.getStatus(), 400);
        return true;
      },
    );
  });
}