require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { UnauthorizedException } = require('@nestjs/common');

const {
  UsuariosService,
} = require('../dist/modules/usuarios/usuarios.service');

const ID = '20000000-0000-4000-8000-000000000001';

function usuario(cambios = {}) {
  return {
    id_usuario: ID,
    nombre: 'Ana',
    apellidos: null,
    foto_perfil_url: null,
    correo: 'ana@example.invalid',
    telefono: null,
    password_hash: 'hash-interno',
    fecha_creacion: new Date('2026-09-16T12:00:00Z'),
    ubicacion: null,
    rol: 'USUARIO',
    estado: 'ACTIVO',
    google_sub: null,
    version_sesion: 3,
    ...cambios,
  };
}

test('sesión: acepta la versión vigente y devuelve únicamente el perfil público', async () => {
  const consultas = [];

  const service = new UsuariosService({
    async findById(id) {
      consultas.push(id);
      return usuario();
    },
  });

  const resultado = await service.obtenerPerfilDeSesion(ID, 3);

  assert.deepEqual(consultas, [ID]);

  assert.deepEqual(resultado, {
    id_usuario: ID,
    nombre: 'Ana',
    apellidos: null,
    foto_perfil_url: null,
    correo: 'ana@example.invalid',
    telefono: null,
    fecha_creacion: '2026-09-16T12:00:00.000Z',
    ubicacion: null,
    rol: 'USUARIO',
    estado: 'ACTIVO',
  });
});

test('sesión: rechaza versiones anteriores y posteriores a la almacenada', async () => {
  const service = new UsuariosService({
    async findById() {
      return usuario();
    },
  });

  for (const version of [0, 2, 4]) {
    await assert.rejects(
      () => service.obtenerPerfilDeSesion(ID, version),
      UnauthorizedException,
    );
  }
});

test('sesión: rechaza cuentas ausentes, inactivas o sin versión válida', async () => {
  for (const fila of [
    null,
    usuario({ estado: 'INACTIVO' }),
    usuario({ version_sesion: undefined }),
    usuario({ version_sesion: null }),
  ]) {
    const service = new UsuariosService({
      async findById() {
        return fila;
      },
    });

    await assert.rejects(
      () => service.obtenerPerfilDeSesion(ID, 3),
      UnauthorizedException,
    );
  }
});

test('sesión: valida la versión recibida antes de consultar PostgreSQL', async () => {
  let consultas = 0;

  const service = new UsuariosService({
    async findById() {
      consultas += 1;
      return usuario();
    },
  });

  for (const version of [
    undefined, null, '3', -1, 1.5, NaN, Infinity, 2_147_483_648,
  ]) {
    await assert.rejects(
      () => service.obtenerPerfilDeSesion(ID, version),
      UnauthorizedException,
    );
  }

  assert.equal(consultas, 0);
});

test('sesión: detecta un cambio de versión entre solicitudes', async () => {
  let versionActual = 3;

  const service = new UsuariosService({
    async findById() {
      return usuario({ version_sesion: versionActual });
    },
  });

  await service.obtenerPerfilDeSesion(ID, 3);

  versionActual = 4;

  await assert.rejects(
    () => service.obtenerPerfilDeSesion(ID, 3),
    UnauthorizedException,
  );

  await service.obtenerPerfilDeSesion(ID, 4);
});

test('sesión: propaga errores de PostgreSQL sin convertirlos en 401', async () => {
  const error = new Error('Fallo de PostgreSQL');

  const service = new UsuariosService({
    async findById() {
      throw error;
    },
  });

  await assert.rejects(
    () => service.obtenerPerfilDeSesion(ID, 3),
    (recibido) => recibido === error,
  );
});