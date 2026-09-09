const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  toUsuarioResponse,
} = require('../dist/modules/usuarios/mappers/usuario.mapper');

/**
 * Datos ficticios utilizados exclusivamente por las pruebas.
 *
 * No se guardan en PostgreSQL. La función devuelve un objeto nuevo
 * para que cada prueba trabaje con datos independientes.
 */
function crearUsuarioDePrueba() {
  return {
    id_usuario: '10000000-0000-4000-8000-000000000001',
    nombre: 'Persona',
    apellidos: 'De prueba',
    foto_perfil_url: null,
    correo: 'persona@example.test',
    telefono: null,
    password_hash: 'HASH_FICTICIO_NO_UTILIZAR',
    fecha_creacion: new Date('2026-09-08T10:30:00.000Z'),
    ubicacion: null,
    rol: 'USUARIO',
    estado: 'ACTIVO',
    google_sub: 'IDENTIDAD_GOOGLE_FICTICIA',
  };
}

test('devuelve únicamente los campos autorizados del perfil', () => {
  const usuario = crearUsuarioDePrueba();

  // Simula una futura columna interna desconocida por el mapper.
  usuario.dato_interno_futuro = 'NO_DEBE_SALIR';

  const resultado = toUsuarioResponse(usuario);

  assert.deepStrictEqual(resultado, {
    id_usuario: usuario.id_usuario,
    nombre: 'Persona',
    apellidos: 'De prueba',
    foto_perfil_url: null,
    correo: 'persona@example.test',
    telefono: null,
    fecha_creacion: '2026-09-08T10:30:00.000Z',
    ubicacion: null,
    rol: 'USUARIO',
    estado: 'ACTIVO',
  });

  assert.equal(Object.hasOwn(resultado, 'password_hash'), false);
  assert.equal(Object.hasOwn(resultado, 'google_sub'), false);
  assert.equal(Object.hasOwn(resultado, 'dato_interno_futuro'), false);
});

test('no modifica el usuario recibido', () => {
  const usuario = crearUsuarioDePrueba();
  const original = structuredClone(usuario);

  const resultado = toUsuarioResponse(usuario);

  assert.deepStrictEqual(usuario, original);
  assert.notStrictEqual(resultado, usuario);
});

test('admite un perfil incompleto de una cuenta exclusiva de Google', () => {
  const usuario = crearUsuarioDePrueba();

  usuario.nombre = null;
  usuario.apellidos = null;
  usuario.password_hash = null;

  const resultado = toUsuarioResponse(usuario);

  assert.equal(resultado.nombre, null);
  assert.equal(resultado.apellidos, null);
  assert.equal(resultado.foto_perfil_url, null);
  assert.equal(resultado.telefono, null);
  assert.equal(resultado.ubicacion, null);
  assert.equal(Object.hasOwn(resultado, 'password_hash'), false);
  assert.equal(Object.hasOwn(resultado, 'google_sub'), false);
});