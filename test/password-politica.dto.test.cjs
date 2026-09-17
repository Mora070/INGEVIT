require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');

const {
  RegisterDto,
} = require('../dist/modules/auth/dto/register.dto');

const {
  CambiarPasswordDto,
} = require('../dist/modules/auth/dto/cambiar-password.dto');

const {
  LoginDto,
} = require('../dist/modules/auth/dto/login.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

async function validar(metatype, body) {
  return createValidationPipe().transform(body, {
    type: 'body',
    metatype,
    data: undefined,
  });
}

const entradas = [
  {
    dto: RegisterDto,
    campo: 'password',
    base: { correo: 'persona@example.invalid' },
  },
  {
    dto: CambiarPasswordDto,
    campo: 'password_nueva',
    base: { password_actual: 'Anterior' },
  },
];

test('política password: registro y cambio aceptan los mismos límites', async () => {
  for (const entrada of entradas) {
    for (const longitud of [8, 128]) {
      const password = 'a'.repeat(longitud);

      const resultado = await validar(entrada.dto, {
        ...entrada.base,
        [entrada.campo]: password,
      });

      assert.equal(resultado[entrada.campo], password);
    }
  }
});

test('política password: registro y cambio rechazan las mismas entradas inválidas', async () => {
  for (const entrada of entradas) {
    for (const password of [
      undefined,
      null,
      123,
      true,
      [],
      {},
      '',
      'a'.repeat(7),
      'a'.repeat(129),
    ]) {
      await assert.rejects(
        () => validar(entrada.dto, {
          ...entrada.base,
          [entrada.campo]: password,
        }),
        BadRequestException,
      );
    }
  }
});

test('política password: ambos flujos conservan espacios y Unicode', async () => {
  const password = '  Una frase de acceso con ñ y 🔐  ';

  for (const entrada of entradas) {
    const resultado = await validar(entrada.dto, {
      ...entrada.base,
      [entrada.campo]: password,
    });

    assert.equal(resultado[entrada.campo], password);
  }
});

test('política password: el login y la contraseña actual conservan compatibilidad', async () => {
  const login = await validar(LoginDto, {
    correo: 'persona@example.invalid',
    password: 'Anterior',
  });

  assert.equal(login.password, 'Anterior');

  const cambio = await validar(CambiarPasswordDto, {
    password_actual: 'Anterior',
    password_nueva: 'Una nueva frase de acceso',
  });

  assert.equal(cambio.password_actual, 'Anterior');
});