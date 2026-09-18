require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');

const {
  LoginDto,
} = require('../dist/modules/auth/dto/login.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

/**
 * Ejecuta la validación tal como se aplicará al cuerpo de una
 * solicitud cuyo controlador declare LoginDto.
 *
 * No inicia un servidor ni consulta PostgreSQL.
 */
async function validarLogin(body) {
  const pipe = createValidationPipe();

  return pipe.transform(body, {
    type: 'body',
    metatype: LoginDto,
    data: undefined,
  });
}

/**
 * Verifica el contrato del error sin depender del orden
 * en que se ejecutan los decoradores de validación.
 */
function comprobarSolicitudInvalida(error) {
  assert.ok(error instanceof BadRequestException);
  assert.equal(error.getStatus(), 400);

  return true;
}

test('LoginDto: acepta credenciales con formato válido y construye el DTO', async () => {
  const resultado = await validarLogin({
    correo: 'persona@example.test',
    password: 'Clave ficticia',
  });

  assert.ok(resultado instanceof LoginDto);
  assert.equal(resultado.correo, 'persona@example.test');
  assert.equal(resultado.password, 'Clave ficticia');
});

test('LoginDto: elimina espacios exteriores del correo sin modificar la contraseña', async () => {
  const entrada = {
    correo: '  Persona@example.test  ',
    password: '  Clave con espacios  ',
  };

  const resultado = await validarLogin(entrada);

  assert.equal(resultado.correo, 'Persona@example.test');
  assert.equal(resultado.password, '  Clave con espacios  ');

  // La transformación no debe modificar el objeto original.
  assert.equal(entrada.correo, '  Persona@example.test  ');
  assert.equal(entrada.password, '  Clave con espacios  ');
});

/**
 * Cada caso se ejecuta como una prueba independiente.
 * Los valores son ficticios y nunca se envían a servicios externos.
 */
const casosInvalidos = [
  {
    nombre: 'correo ausente',
    body: { password: 'Clave ficticia' },
  },
  {
    nombre: 'correo vacío',
    body: { correo: '', password: 'Clave ficticia' },
  },
  {
    nombre: 'correo compuesto solo por espacios',
    body: { correo: '   ', password: 'Clave ficticia' },
  },
  {
    nombre: 'correo con formato inválido',
    body: { correo: 'correo-invalido', password: 'Clave ficticia' },
  },
  {
    nombre: 'correo de tipo numérico',
    body: { correo: 123, password: 'Clave ficticia' },
  },
  {
    nombre: 'contraseña ausente',
    body: { correo: 'persona@example.test' },
  },
  {
    nombre: 'contraseña vacía',
    body: { correo: 'persona@example.test', password: '' },
  },
  {
    nombre: 'contraseña nula',
    body: { correo: 'persona@example.test', password: null },
  },
  {
    nombre: 'contraseña de tipo numérico',
    body: { correo: 'persona@example.test', password: 123456 },
  },
  {
    nombre: 'contraseña de tipo booleano',
    body: { correo: 'persona@example.test', password: true },
  },
  {
    nombre: 'contraseña de tipo objeto',
    body: { correo: 'persona@example.test', password: { valor: 'clave' } },
  },
  {
    nombre: 'contraseña de tipo arreglo',
    body: { correo: 'persona@example.test', password: ['clave'] },
  },
  {
    nombre: 'campo adicional rol',
    body: {
      correo: 'persona@example.test',
      password: 'Clave ficticia',
      rol: 'ADMINISTRADOR',
    },
  },
  {
    nombre: 'campo adicional estado',
    body: {
      correo: 'persona@example.test',
      password: 'Clave ficticia',
      estado: 'ACTIVO',
    },
  },
];

for (const { nombre, body } of casosInvalidos) {
  test(`LoginDto: rechaza ${nombre}`, async () => {
    await assert.rejects(
      () => validarLogin(body),
      comprobarSolicitudInvalida,
    );
  });
}

test('LoginDto: el error de validación no devuelve la contraseña recibida', async () => {
  const password = 'SECRETO_FICTICIO_NO_DEBE_APARECER';

  await assert.rejects(
    () =>
      validarLogin({
        correo: 'correo-invalido',
        password,
      }),
    (error) => {
      comprobarSolicitudInvalida(error);

      const respuesta = error.getResponse();

      assert.ok(Array.isArray(respuesta.message));
      assert.equal(JSON.stringify(respuesta).includes(password), false);
      assert.equal(Object.hasOwn(respuesta, 'target'), false);
      assert.equal(Object.hasOwn(respuesta, 'value'), false);

      return true;
    },
  );
});