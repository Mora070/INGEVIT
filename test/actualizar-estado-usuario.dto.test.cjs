require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');

const {
  ActualizarEstadoUsuarioDto,
} = require('../dist/modules/usuarios/dto/actualizar-estado-usuario.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

/**
 * Utiliza el DTO y la configuración real de validación.
 * No consulta PostgreSQL ni modifica usuarios.
 */
async function validarEstado(body) {
  return createValidationPipe().transform(body, {
    type: 'body',
    metatype: ActualizarEstadoUsuarioDto,
    data: undefined,
  });
}

function comprobarEntradaRechazada(error) {
  assert.ok(error instanceof BadRequestException);
  assert.equal(error.getStatus(), 400);
  return true;
}

test('ActualizarEstadoUsuarioDto: admite los dos estados definidos', async () => {
  for (const estado of ['ACTIVO', 'INACTIVO']) {
    const resultado = await validarEstado({ estado });

    assert.ok(resultado instanceof ActualizarEstadoUsuarioDto);
    assert.equal(resultado.estado, estado);
  }
});

test('ActualizarEstadoUsuarioDto: rechaza un estado ausente o nulo', async () => {
  for (const entrada of [{}, { estado: undefined }, { estado: null }]) {
    await assert.rejects(
      () => validarEstado(entrada),
      comprobarEntradaRechazada,
    );
  }
});

test('ActualizarEstadoUsuarioDto: rechaza estados no definidos y variantes de formato', async () => {
  const estadosInvalidos = [
    '',
    ' ',
    'activo',
    'inactivo',
    ' ACTIVO ',
    'PAUSA',
    'FINALIZADA',
    'ELIMINADO',
  ];

  for (const estado of estadosInvalidos) {
    await assert.rejects(
      () => validarEstado({ estado }),
      comprobarEntradaRechazada,
    );
  }
});

test('ActualizarEstadoUsuarioDto: rechaza valores que no son texto', async () => {
  for (const estado of [1, true, {}, ['ACTIVO']]) {
    await assert.rejects(
      () => validarEstado({ estado }),
      comprobarEntradaRechazada,
    );
  }
});

test('ActualizarEstadoUsuarioDto: rechaza propiedades adicionales', async () => {
  const camposNoPermitidos = [
    ['rol', 'ADMINISTRADOR'],
    ['correo', 'otra@example.test'],
    ['id_usuario', '10000000-0000-4000-8000-000000000001'],
    ['password_hash', 'HASH_FICTICIO'],
    ['google_sub', 'IDENTIDAD_FICTICIA'],
    ['activo', false],
  ];

  for (const [campo, valor] of camposNoPermitidos) {
    await assert.rejects(
      () =>
        validarEstado({
          estado: 'INACTIVO',
          [campo]: valor,
        }),
      comprobarEntradaRechazada,
    );
  }
});