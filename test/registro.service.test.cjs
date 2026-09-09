require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConflictException } = require('@nestjs/common');

const {
  AuthService,
} = require('../dist/modules/auth/auth.service');

const {
  UsuariosService,
} = require('../dist/modules/usuarios/usuarios.service');

const HASH = 'HASH_FICTICIO_PARA_PRUEBAS';

function crearFila() {
  return {
    id_usuario: '10000000-0000-4000-8000-000000000001',
    nombre: null,
    apellidos: null,
    foto_perfil_url: null,
    correo: 'persona@example.test',
    telefono: null,
    password_hash: HASH,
    fecha_creacion: new Date('2026-09-08T10:30:00.000Z'),
    ubicacion: null,
    rol: 'USUARIO',
    estado: 'ACTIVO',
    google_sub: null,
  };
}

/**
 * Construye AuthService con dependencias controladas.
 *
 * No ejecuta Argon2 ni PostgreSQL: esas integraciones ya tienen pruebas.
 * Registra el orden de las operaciones y los datos enviados.
 */
function crearEscenario({ errorHash, errorCreacion } = {}) {
  const llamadas = [];
  const fila = crearFila();

  const usuariosService = {
    async crearTradicional(datos) {
      llamadas.push({ operacion: 'crear', datos });

      if (errorCreacion) {
        throw errorCreacion;
      }

      return fila;
    },
  };

  const passwordService = {
    async generarHash(password) {
      llamadas.push({ operacion: 'hash', password });

      if (errorHash) {
        throw errorHash;
      }

      return HASH;
    },
  };

  const tokenService = {
    async emitirToken() {
      llamadas.push({ operacion: 'token' });

      // El registro no debe intentar emitir un token.
      throw new Error('Emisión de token inesperada durante el registro.');
    },
  };

  return {
    service: new AuthService(
      usuariosService,
      passwordService,
      tokenService,
    ),
    llamadas,
    fila,
  };
}

test('registrar: genera el hash antes de crear la cuenta y devuelve un perfil seguro', async () => {
  const { service, llamadas } = crearEscenario();

  const resultado = await service.registrar({
    correo: 'persona@example.test',
    password: '  Clave ficticia  ',
  });

  assert.deepEqual(llamadas, [
    {
      operacion: 'hash',
      password: '  Clave ficticia  ',
    },
    {
      operacion: 'crear',
      datos: {
        correo: 'persona@example.test',
        passwordHash: HASH,
        nombre: null,
        apellidos: null,
        telefono: null,
        ubicacion: null,
      },
    },
  ]);

  assert.deepEqual(resultado, {
    id_usuario: '10000000-0000-4000-8000-000000000001',
    nombre: null,
    apellidos: null,
    foto_perfil_url: null,
    correo: 'persona@example.test',
    telefono: null,
    fecha_creacion: '2026-09-08T10:30:00.000Z',
    ubicacion: null,
    rol: 'USUARIO',
    estado: 'ACTIVO',
  });
});

test('registrar: transmite los campos de perfil y excluye propiedades internas del cliente', async () => {
  const { service, llamadas } = crearEscenario();

  await service.registrar({
    correo: 'persona@example.test',
    password: 'Clave ficticia',
    nombre: 'Persona',
    apellidos: 'De prueba',
    telefono: '+57 03001234567',
    ubicacion: 'Bogotá',

    // Simula un objeto que llegó a la capa interna sin pasar por el DTO.
    rol: 'ADMINISTRADOR',
    estado: 'INACTIVO',
    password_hash: 'HASH_NO_AUTORIZADO',
    google_sub: 'IDENTIDAD_NO_AUTORIZADA',
  });

  const creacion = llamadas.find(
    (llamada) => llamada.operacion === 'crear',
  );

  assert.deepEqual(creacion.datos, {
    correo: 'persona@example.test',
    passwordHash: HASH,
    nombre: 'Persona',
    apellidos: 'De prueba',
    telefono: '+57 03001234567',
    ubicacion: 'Bogotá',
  });

  assert.equal(Object.hasOwn(creacion.datos, 'password'), false);
  assert.equal(
    llamadas.some((llamada) => llamada.operacion === 'token'),
    false,
  );
});

test('registrar: no modifica el objeto recibido', async () => {
  const { service } = crearEscenario();

  const datos = {
    correo: 'persona@example.test',
    password: 'Clave ficticia',
    nombre: null,
    apellidos: null,
    telefono: null,
    ubicacion: null,
  };

  const original = structuredClone(datos);

  await service.registrar(datos);

  assert.deepEqual(datos, original);
});

test('registrar: no intenta crear la cuenta si falla la generación del hash', async () => {
  const errorOriginal = new Error('Fallo criptográfico simulado');

  const { service, llamadas } = crearEscenario({
    errorHash: errorOriginal,
  });

  await assert.rejects(
    () =>
      service.registrar({
        correo: 'persona@example.test',
        password: 'Clave ficticia',
      }),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );

  assert.deepEqual(
    llamadas.map((llamada) => llamada.operacion),
    ['hash'],
  );
});

test('registrar: propaga el conflicto de correo sin emitir un token', async () => {
  const errorOriginal = new ConflictException(
    'No se puede registrar una cuenta con ese correo.',
  );

  const { service, llamadas } = crearEscenario({
    errorCreacion: errorOriginal,
  });

  await assert.rejects(
    () =>
      service.registrar({
        correo: 'persona@example.test',
        password: 'Clave ficticia',
      }),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      assert.equal(error.getStatus(), 409);
      return true;
    },
  );

  assert.deepEqual(
    llamadas.map((llamada) => llamada.operacion),
    ['hash', 'crear'],
  );
});

test('registrar: propaga un fallo técnico de creación', async () => {
  const errorOriginal = new Error('Fallo simulado de PostgreSQL');

  const { service } = crearEscenario({
    errorCreacion: errorOriginal,
  });

  await assert.rejects(
    () =>
      service.registrar({
        correo: 'persona@example.test',
        password: 'Clave ficticia',
      }),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});

test('UsuariosService.crearTradicional: delega la inserción y devuelve la fila creada', async () => {
  const fila = crearFila();
  const llamadas = [];

  const service = new UsuariosService({
    async crearTradicional(datos) {
      llamadas.push(datos);
      return fila;
    },
  });

  const datos = {
    correo: 'persona@example.test',
    passwordHash: HASH,
    nombre: null,
    apellidos: null,
    telefono: null,
    ubicacion: null,
  };

  const resultado = await service.crearTradicional(datos);

  assert.strictEqual(resultado, fila);
  assert.deepEqual(llamadas, [datos]);
});

test('UsuariosService.crearTradicional: convierte un correo duplicado en HTTP 409', async () => {
  const service = new UsuariosService({
    async crearTradicional() {
      return null;
    },
  });

  await assert.rejects(
    () =>
      service.crearTradicional({
        correo: 'persona@example.test',
        passwordHash: HASH,
        nombre: null,
        apellidos: null,
        telefono: null,
        ubicacion: null,
      }),
    (error) => {
      assert.ok(error instanceof ConflictException);
      assert.equal(error.getStatus(), 409);
      assert.equal(
        error.message,
        'No se puede registrar una cuenta con ese correo.',
      );
      return true;
    },
  );
});

test('UsuariosService.crearTradicional: conserva los errores técnicos del repositorio', async () => {
  const errorOriginal = new Error('Fallo simulado de PostgreSQL');

  const service = new UsuariosService({
    async crearTradicional() {
      throw errorOriginal;
    },
  });

  await assert.rejects(
    () =>
      service.crearTradicional({
        correo: 'persona@example.test',
        passwordHash: HASH,
        nombre: null,
        apellidos: null,
        telefono: null,
        ubicacion: null,
      }),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});