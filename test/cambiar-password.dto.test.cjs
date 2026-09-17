require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');

const {
  CambiarPasswordDto,
} = require('../dist/modules/auth/dto/cambiar-password.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

async function validar(body) {
  return createValidationPipe().transform(body, {
    type: 'body',
    metatype: CambiarPasswordDto,
    data: undefined,
  });
}

function esSolicitudInvalida(error) {
  assert.ok(error instanceof BadRequestException);
  assert.equal(error.getStatus(), 400);
  return true;
}

test('cambiar password DTO: conserva espacios y Unicode sin modificar la entrada', async () => {
  const entrada = {
    password_actual: '  Clave anterior ñ  ',
    password_nueva: '  Mi nueva frase de acceso ñ  ',
  };

  const copia = { ...entrada };
  const resultado = await validar(entrada);

  assert.ok(resultado instanceof CambiarPasswordDto);
  assert.equal(resultado.password_actual, entrada.password_actual);
  assert.equal(resultado.password_nueva, entrada.password_nueva);
  assert.deepEqual(entrada, copia);
});

test('cambiar password DTO: admite los límites de longitud de la contraseña nueva', async () => {
  for (const longitud of [8, 128]) {
    const resultado = await validar({
      password_actual: 'Anterior',
      password_nueva: 'a'.repeat(longitud),
    });

    assert.equal(resultado.password_nueva.length, longitud);
  }
});

test('cambiar password DTO: rechaza longitudes fuera de los límites', async () => {
  for (const longitud of [0, 7, 129]) {
    await assert.rejects(
      () => validar({
        password_actual: 'Anterior',
        password_nueva: 'a'.repeat(longitud),
      }),
      esSolicitudInvalida,
    );
  }
});

test('cambiar password DTO: rechaza campos ausentes y tipos incorrectos', async () => {
  for (const campo of ['password_actual', 'password_nueva']) {
    for (const valor of [undefined, null, 123, true, {}, []]) {
      await assert.rejects(
        () => validar({
          password_actual: 'Anterior',
          password_nueva: 'Nueva frase de acceso',
          [campo]: valor,
        }),
        esSolicitudInvalida,
      );
    }
  }

  await assert.rejects(
    () => validar({
      password_actual: '',
      password_nueva: 'Nueva frase de acceso',
    }),
    esSolicitudInvalida,
  );
});

test('cambiar password DTO: rechaza campos adicionales', async () => {
  for (const campo of [
    'id_usuario',
    'correo',
    'rol',
    'password_hash',
    'google_sub',
  ]) {
    await assert.rejects(
      () => validar({
        password_actual: 'Anterior',
        password_nueva: 'Nueva frase de acceso',
        [campo]: 'valor-no-permitido',
      }),
      esSolicitudInvalida,
    );
  }
});

test('cambiar password DTO: no incluye las contraseñas en la respuesta de validación', async () => {
  const actual = 'secreto-actual-no-publico';
  const nueva = 'corta';

  await assert.rejects(
    () => validar({
      password_actual: actual,
      password_nueva: nueva,
    }),
    (error) => {
      esSolicitudInvalida(error);

      const respuesta = JSON.stringify(error.getResponse());

      assert.equal(respuesta.includes(actual), false);
      assert.equal(respuesta.includes(nueva), false);

      return true;
    },
  );
});