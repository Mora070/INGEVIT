require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');

const {
  ActualizarMiPerfilDto,
} = require('../dist/modules/usuarios/dto/actualizar-mi-perfil.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

async function validar(body) {
  return createValidationPipe().transform(body, {
    type: 'body',
    metatype: ActualizarMiPerfilDto,
    data: undefined,
  });
}

function esSolicitudInvalida(error) {
  assert.ok(error instanceof BadRequestException);
  assert.equal(error.getStatus(), 400);
  return true;
}

test('perfil DTO: normaliza los datos personales sin modificar la entrada', async () => {
  const entrada = {
    nombre: '  Víctor  ',
    apellidos: '  Pérez Gómez  ',
    telefono: '  +57 300 123 4567  ',
    ubicacion: '  Bogotá, Colombia  ',
  };

  const copia = { ...entrada };
  const resultado = await validar(entrada);

  assert.ok(resultado instanceof ActualizarMiPerfilDto);
  assert.equal(resultado.nombre, 'Víctor');
  assert.equal(resultado.apellidos, 'Pérez Gómez');
  assert.equal(resultado.telefono, '+57 300 123 4567');
  assert.equal(resultado.ubicacion, 'Bogotá, Colombia');
  assert.deepEqual(entrada, copia);
});

test('perfil DTO: permite actualizar un campo conservando los demás como omitidos', async () => {
  const resultado = await validar({ nombre: 'Ana' });

  assert.equal(resultado.nombre, 'Ana');
  assert.equal(resultado.apellidos, undefined);
  assert.equal(resultado.telefono, undefined);
  assert.equal(resultado.ubicacion, undefined);
});

test('perfil DTO: permite borrar datos mediante null o texto vacío', async () => {
  const resultado = await validar({
    nombre: null,
    apellidos: '',
    telefono: '   ',
    ubicacion: null,
  });

  assert.equal(resultado.nombre, null);
  assert.equal(resultado.apellidos, null);
  assert.equal(resultado.telefono, null);
  assert.equal(resultado.ubicacion, null);
});

test('perfil DTO: rechaza tipos incorrectos y caracteres nulos', async () => {
  for (const campo of [
    'nombre', 'apellidos', 'telefono', 'ubicacion',
  ]) {
    for (const valor of [123, true, {}, [], 'texto\u0000']) {
      await assert.rejects(
        () => validar({ [campo]: valor }),
        esSolicitudInvalida,
      );
    }
  }
});

test('perfil DTO: aplica los límites de longitud', async () => {
  const limites = {
    nombre: 100,
    apellidos: 150,
    telefono: 32,
    ubicacion: 200,
  };

  for (const [campo, limite] of Object.entries(limites)) {
    const resultado = await validar({
      [campo]: 'a'.repeat(limite),
    });

    assert.equal(resultado[campo].length, limite);

    await assert.rejects(
      () => validar({ [campo]: 'a'.repeat(limite + 1) }),
      esSolicitudInvalida,
    );
  }
});

test('perfil DTO: rechaza identidad, permisos y campos de otros flujos', async () => {
  for (const campo of [
    'id_usuario',
    'rol',
    'estado',
    'correo',
    'password',
    'password_hash',
    'google_sub',
    'foto_perfil_url',
  ]) {
    await assert.rejects(
      () => validar({
        nombre: 'Ana',
        [campo]: 'valor-no-permitido',
      }),
      esSolicitudInvalida,
    );
  }
});