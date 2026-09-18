require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');

const {
  AgregarColaboradorDto,
} = require('../dist/modules/proyectos/dto/agregar-colaborador.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

const ID_COLABORADOR = '10000000-0000-4000-8000-000000000001';

/**
 * Ejecuta el DTO con la configuración real de validación.
 * No consulta usuarios ni agrega relaciones en PostgreSQL.
 */
async function validarColaborador(body) {
  return createValidationPipe().transform(body, {
    type: 'body',
    metatype: AgregarColaboradorDto,
    data: undefined,
  });
}

function comprobarEntradaRechazada(error) {
  assert.ok(error instanceof BadRequestException);
  assert.equal(error.getStatus(), 400);
  return true;
}

test('AgregarColaboradorDto: acepta un UUID válido', async () => {
  const resultado = await validarColaborador({
    id_usuario: ID_COLABORADOR,
  });

  assert.ok(resultado instanceof AgregarColaboradorDto);
  assert.equal(resultado.id_usuario, ID_COLABORADOR);
});

test('AgregarColaboradorDto: exige el identificador del colaborador', async () => {
  for (const entrada of [
    {},
    { id_usuario: undefined },
    { id_usuario: null },
    { id_usuario: '' },
  ]) {
    await assert.rejects(
      () => validarColaborador(entrada),
      comprobarEntradaRechazada,
    );
  }
});

test('AgregarColaboradorDto: rechaza identificadores malformados o de tipo incorrecto', async () => {
  const valoresInvalidos = [
    'usuario-invalido',
    'persona@example.test',
    ` ${ID_COLABORADOR} `,
    123,
    true,
    {},
    [ID_COLABORADOR],
  ];

  for (const id_usuario of valoresInvalidos) {
    await assert.rejects(
      () => validarColaborador({ id_usuario }),
      comprobarEntradaRechazada,
    );
  }
});

test('AgregarColaboradorDto: rechaza campos ajenos a la operación', async () => {
  const camposNoPermitidos = [
    ['rol', 'ADMINISTRADOR'],
    ['estado', 'ACTIVO'],
    ['id_propietario', ID_COLABORADOR],
    ['id_proyecto', '20000000-0000-4000-8000-000000000002'],
    ['correo', 'persona@example.test'],
  ];

  for (const [campo, valor] of camposNoPermitidos) {
    await assert.rejects(
      () =>
        validarColaborador({
          id_usuario: ID_COLABORADOR,
          [campo]: valor,
        }),
      comprobarEntradaRechazada,
    );
  }
});