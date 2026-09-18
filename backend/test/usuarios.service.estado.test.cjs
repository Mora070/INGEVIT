require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException } = require('@nestjs/common');

const {
  UsuariosService,
} = require('../dist/modules/usuarios/usuarios.service');

const ID_USUARIO = '10000000-0000-4000-8000-000000000001';

function crearFila(estado) {
  return {
    id_usuario: ID_USUARIO,
    nombre: 'Persona',
    apellidos: 'De prueba',
    foto_perfil_url: null,
    correo: 'persona@example.test',
    telefono: null,
    password_hash: 'HASH_FICTICIO_NO_DEVOLVER',
    fecha_creacion: new Date('2026-09-08T10:30:00.000Z'),
    ubicacion: null,
    rol: 'USUARIO',
    estado,
    google_sub: 'IDENTIDAD_GOOGLE_NO_DEVOLVER',
  };
}

test('UsuariosService.actualizarEstado: devuelve el perfil inactivo sin datos sensibles', async () => {
  const fila = crearFila('INACTIVO');
  const llamadas = [];

  const service = new UsuariosService({
    async actualizarEstado(idUsuario, estado) {
      llamadas.push({ idUsuario, estado });
      return fila;
    },
  });

  const resultado = await service.actualizarEstado(
    ID_USUARIO,
    'INACTIVO',
  );

  assert.deepEqual(llamadas, [
    { idUsuario: ID_USUARIO, estado: 'INACTIVO' },
  ]);

  // Una inactivación correcta debe devolver el estado resultante.
  assert.deepEqual(resultado, {
    id_usuario: ID_USUARIO,
    nombre: 'Persona',
    apellidos: 'De prueba',
    foto_perfil_url: null,
    correo: 'persona@example.test',
    telefono: null,
    fecha_creacion: '2026-09-08T10:30:00.000Z',
    ubicacion: null,
    rol: 'USUARIO',
    estado: 'INACTIVO',
  });
});

test('UsuariosService.actualizarEstado: permite devolver una cuenta reactivada', async () => {
  const llamadas = [];

  const service = new UsuariosService({
    async actualizarEstado(idUsuario, estado) {
      llamadas.push({ idUsuario, estado });
      return crearFila('ACTIVO');
    },
  });

  const resultado = await service.actualizarEstado(
    ID_USUARIO,
    'ACTIVO',
  );

  assert.equal(resultado.estado, 'ACTIVO');
  assert.deepEqual(llamadas, [
    { idUsuario: ID_USUARIO, estado: 'ACTIVO' },
  ]);
});

test('UsuariosService.actualizarEstado: devuelve 404 cuando el usuario no existe', async () => {
  const service = new UsuariosService({
    async actualizarEstado() {
      return null;
    },
  });

  await assert.rejects(
    () => service.actualizarEstado(ID_USUARIO, 'INACTIVO'),
    (error) => {
      assert.ok(error instanceof NotFoundException);
      assert.equal(error.getStatus(), 404);
      assert.equal(error.message, 'El usuario no existe.');
      return true;
    },
  );
});

test('UsuariosService.actualizarEstado: propaga los errores técnicos del repositorio', async () => {
  const errorOriginal = new Error('Fallo simulado de PostgreSQL');

  const service = new UsuariosService({
    async actualizarEstado() {
      throw errorOriginal;
    },
  });

  await assert.rejects(
    () => service.actualizarEstado(ID_USUARIO, 'INACTIVO'),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});

test('UsuariosService.actualizarEstado: no modifica la fila devuelta por el repositorio', async () => {
  const fila = crearFila('INACTIVO');
  const original = structuredClone(fila);

  const service = new UsuariosService({
    async actualizarEstado() {
      return fila;
    },
  });

  const resultado = await service.actualizarEstado(
    ID_USUARIO,
    'INACTIVO',
  );

  assert.deepEqual(fila, original);
  assert.notStrictEqual(resultado, fila);
});