require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');

const {
  RegisterDto,
} = require('../dist/modules/auth/dto/register.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

/**
 * Ejecuta la configuración de validación utilizada por el backend.
 * No crea cuentas ni consulta PostgreSQL.
 */
async function validarRegistro(body) {
  return createValidationPipe().transform(body, {
    type: 'body',
    metatype: RegisterDto,
    data: undefined,
  });
}

function comprobarRegistroRechazado(error) {
  assert.ok(error instanceof BadRequestException);
  assert.equal(error.getStatus(), 400);

  return true;
}

test('RegisterDto: acepta el registro con correo y contraseña', async () => {
  const resultado = await validarRegistro({
    correo: 'persona@example.test',
    password: 'Clave ficticia',
  });

  assert.ok(resultado instanceof RegisterDto);
  assert.equal(resultado.correo, 'persona@example.test');
  assert.equal(resultado.password, 'Clave ficticia');
});

test('RegisterDto: acepta los campos de perfil definidos', async () => {
  const resultado = await validarRegistro({
    correo: 'persona@example.test',
    password: 'Clave ficticia',
    nombre: 'Persona',
    apellidos: 'De prueba',
    telefono: '+57 03001234567',
    ubicacion: 'Bogotá',
  });

  assert.equal(resultado.nombre, 'Persona');
  assert.equal(resultado.apellidos, 'De prueba');
  assert.equal(resultado.telefono, '+57 03001234567');
  assert.equal(resultado.ubicacion, 'Bogotá');
});

test('RegisterDto: admite campos opcionales nulos', async () => {
  const resultado = await validarRegistro({
    correo: 'persona@example.test',
    password: 'Clave ficticia',
    nombre: null,
    apellidos: null,
    telefono: null,
    ubicacion: null,
  });

  assert.equal(resultado.nombre, null);
  assert.equal(resultado.apellidos, null);
  assert.equal(resultado.telefono, null);
  assert.equal(resultado.ubicacion, null);
});

test('RegisterDto: normaliza el correo y conserva exactamente la contraseña', async () => {
  const entrada = {
    correo: '  Persona@example.test  ',
    password: '  Construcción-Ñ-🔐  ',
  };

  const resultado = await validarRegistro(entrada);

  assert.equal(resultado.correo, 'Persona@example.test');
  assert.equal(resultado.password, entrada.password);

  // La transformación no debe modificar el objeto recibido.
  assert.equal(entrada.correo, '  Persona@example.test  ');
});

/**
 * El registro no permite que el cliente escriba campos internos.
 * Cada campo se comprueba por separado para detectar omisiones.
 */
const camposNoPermitidos = [
  ['id_usuario', '10000000-0000-4000-8000-000000000001'],
  ['rol', 'ADMINISTRADOR'],
  ['estado', 'ACTIVO'],
  ['password_hash', 'HASH_FICTICIO'],
  ['google_sub', 'IDENTIDAD_FICTICIA'],
  ['fecha_creacion', '2026-09-08T10:30:00.000Z'],
  ['foto_perfil_url', 'https://example.test/foto.png'],
];

for (const [campo, valor] of camposNoPermitidos) {
  test(`RegisterDto: rechaza el campo no permitido ${campo}`, async () => {
    await assert.rejects(
      () =>
        validarRegistro({
          correo: 'persona@example.test',
          password: 'Clave ficticia',
          [campo]: valor,
        }),
      comprobarRegistroRechazado,
    );
  });
}

test('RegisterDto: rechaza credenciales ausentes o con formato incorrecto', async () => {
  const entradasInvalidas = [
    {},
    { correo: 'persona@example.test' },
    { password: 'Clave ficticia' },
    { correo: '   ', password: 'Clave ficticia' },
    { correo: 'correo-invalido', password: 'Clave ficticia' },
    { correo: 123, password: 'Clave ficticia' },
    { correo: 'persona@example.test', password: '' },
    { correo: 'persona@example.test', password: null },
    { correo: 'persona@example.test', password: 123456 },
  ];

  for (const entrada of entradasInvalidas) {
    await assert.rejects(
      () => validarRegistro(entrada),
      comprobarRegistroRechazado,
    );
  }
});

test('RegisterDto: rechaza tipos incorrectos en los campos de perfil', async () => {
  const campos = ['nombre', 'apellidos', 'telefono', 'ubicacion'];
  const valoresInvalidos = [123, true, {}, ['texto']];

  for (const campo of campos) {
    for (const valor of valoresInvalidos) {
      await assert.rejects(
        () =>
          validarRegistro({
            correo: 'persona@example.test',
            password: 'Clave ficticia',
            [campo]: valor,
          }),
        comprobarRegistroRechazado,
      );
    }
  }
});

test('RegisterDto: no devuelve la contraseña en los errores de validación', async () => {
  const password = 'SECRETO_FICTICIO_NO_DEVOLVER';

  await assert.rejects(
    () =>
      validarRegistro({
        correo: 'correo-invalido',
        password,
      }),
    (error) => {
      comprobarRegistroRechazado(error);

      const respuesta = JSON.stringify(error.getResponse());

      assert.equal(respuesta.includes(password), false);
      return true;
    },
  );
});