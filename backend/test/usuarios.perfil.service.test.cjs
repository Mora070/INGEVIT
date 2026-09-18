require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BadRequestException,
  UnauthorizedException,
} = require('@nestjs/common');

const {
  UsuariosService,
} = require('../dist/modules/usuarios/usuarios.service');

const ID = '20000000-0000-4000-8000-000000000001';

function usuario(cambios = {}) {
  return {
    id_usuario: ID,
    nombre: 'Ana',
    apellidos: 'Pérez',
    foto_perfil_url: null,
    correo: 'ana@example.invalid',
    telefono: null,
    password_hash: 'hash-interno-no-publico',
    fecha_creacion: new Date('2026-09-16T12:00:00Z'),
    ubicacion: 'Bogotá',
    rol: 'USUARIO',
    estado: 'ACTIVO',
    google_sub: 'identidad-google-no-publica',
    ...cambios,
  };
}

function escenario(fila = usuario()) {
  const llamadas = [];

  const servicio = new UsuariosService({
    async actualizarPerfil(id, datos) {
      llamadas.push({ id, datos });
      return fila;
    },
  });

  return { servicio, llamadas };
}

test('perfil service: utiliza la identidad recibida y devuelve un perfil seguro', async () => {
  const e = escenario();

  const resultado = await e.servicio.actualizarMiPerfil(ID, {
    nombre: 'Ana',
  });

  assert.equal(e.llamadas.length, 1);
  assert.equal(e.llamadas[0].id, ID);

  assert.deepEqual(resultado, {
    id_usuario: ID,
    nombre: 'Ana',
    apellidos: 'Pérez',
    foto_perfil_url: null,
    correo: 'ana@example.invalid',
    telefono: null,
    fecha_creacion: '2026-09-16T12:00:00.000Z',
    ubicacion: 'Bogotá',
    rol: 'USUARIO',
    estado: 'ACTIVO',
  });
});

test('perfil service: rechaza solicitudes sin campos modificables', async () => {
  const e = escenario();

  for (const datos of [
    {},
    { nombre: undefined },
    { rol: 'ADMINISTRADOR' },
  ]) {
    await assert.rejects(
      () => e.servicio.actualizarMiPerfil(ID, datos),
      (error) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(error.getStatus(), 400);
        return true;
      },
    );
  }

  assert.equal(e.llamadas.length, 0);
});

test('perfil service: permite borrar un campo mediante null', async () => {
  const e = escenario(usuario({ telefono: null }));

  await e.servicio.actualizarMiPerfil(ID, { telefono: null });

  assert.deepEqual(e.llamadas[0], {
    id: ID,
    datos: {
      nombre: undefined,
      apellidos: undefined,
      telefono: null,
      ubicacion: undefined,
    },
  });
});

test('perfil service: selecciona los campos autorizados sin modificar la entrada', async () => {
  const e = escenario();

  const entrada = Object.freeze({
    nombre: 'Ana',
    id_usuario: 'otro-usuario',
    rol: 'ADMINISTRADOR',
    estado: 'INACTIVO',
    correo: 'otro@example.invalid',
  });

  await e.servicio.actualizarMiPerfil(ID, entrada);

  assert.deepEqual(e.llamadas[0], {
    id: ID,
    datos: {
      nombre: 'Ana',
      apellidos: undefined,
      telefono: undefined,
      ubicacion: undefined,
    },
  });

  assert.equal(entrada.id_usuario, 'otro-usuario');
  assert.equal(entrada.nombre, 'Ana');
});

test('perfil service: rechaza una cuenta inexistente o inactiva', async () => {
  for (const fila of [
    null,
    usuario({ estado: 'INACTIVO' }),
  ]) {
    const e = escenario(fila);

    await assert.rejects(
      () => e.servicio.actualizarMiPerfil(ID, { nombre: 'Ana' }),
      (error) => {
        assert.ok(error instanceof UnauthorizedException);
        assert.equal(error.getStatus(), 401);
        return true;
      },
    );
  }
});

test('perfil service: admite una cuenta activa exclusiva de Google', async () => {
  const e = escenario(usuario({
    nombre: null,
    apellidos: null,
    password_hash: null,
    ubicacion: null,
  }));

  const resultado = await e.servicio.actualizarMiPerfil(ID, {
    nombre: null,
  });

  assert.equal(resultado.nombre, null);
  assert.equal(resultado.estado, 'ACTIVO');
  assert.equal(Object.hasOwn(resultado, 'password_hash'), false);
  assert.equal(Object.hasOwn(resultado, 'google_sub'), false);
});

test('perfil service: propaga errores del repositorio sin convertirlos en 401', async () => {
  const error = new Error('Fallo de PostgreSQL');
  let llamadas = 0;

  const servicio = new UsuariosService({
    async actualizarPerfil() {
      llamadas += 1;
      throw error;
    },
  });

  await assert.rejects(
    () => servicio.actualizarMiPerfil(ID, { nombre: 'Ana' }),
    (recibido) => recibido === error,
  );

  assert.equal(llamadas, 1);
});