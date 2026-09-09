require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { UnauthorizedException } = require('@nestjs/common');

const {
  UsuariosService,
} = require('../dist/modules/usuarios/usuarios.service');

/**
 * Construye datos independientes para cada prueba.
 * No crea usuarios ni establece conexiones con PostgreSQL.
 */
function crearUsuario(cambios = {}) {
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
    google_sub: null,
    ...cambios,
  };
}

/**
 * Comprueba el rechazo de una identidad que ya no permite acceso.
 * Ambos casos utilizan la misma respuesta pública.
 */
function comprobarAccesoRechazado(error) {
  assert.ok(error instanceof UnauthorizedException);
  assert.equal(error.getStatus(), 401);
  assert.equal(
    error.message,
    'La sesión no es válida o la cuenta no está activa.',
  );

  return true;
}

test('obtenerMiPerfil: consulta la identidad recibida y devuelve un perfil seguro', async () => {
  const usuario = crearUsuario();
  const identificadoresConsultados = [];

  // Simulamos únicamente la dependencia que utiliza el servicio.
  const repository = {
    async findById(idUsuario) {
      identificadoresConsultados.push(idUsuario);
      return usuario;
    },
  };

  const service = new UsuariosService(repository);

  const resultado = await service.obtenerMiPerfil(usuario.id_usuario);

  assert.deepEqual(identificadoresConsultados, [usuario.id_usuario]);

  // La comparación exacta detecta también campos adicionales inesperados.
  assert.deepEqual(resultado, {
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
});

test('obtenerMiPerfil: rechaza una cuenta inactiva', async () => {
  const usuario = crearUsuario({ estado: 'INACTIVO' });

  const service = new UsuariosService({
    async findById() {
      return usuario;
    },
  });

  await assert.rejects(
    () => service.obtenerMiPerfil(usuario.id_usuario),
    comprobarAccesoRechazado,
  );
});

test('obtenerMiPerfil: rechaza una identidad que ya no existe', async () => {
  const service = new UsuariosService({
    async findById() {
      return null;
    },
  });

  await assert.rejects(
    () =>
      service.obtenerMiPerfil(
        '10000000-0000-4000-8000-000000000001',
      ),
    comprobarAccesoRechazado,
  );
});

test('obtenerMiPerfil: permite una cuenta activa exclusiva de Google', async () => {
  const usuario = crearUsuario({
    nombre: null,
    apellidos: null,
    password_hash: null,
    google_sub: 'google-sub-ficticio',
  });

  const service = new UsuariosService({
    async findById() {
      return usuario;
    },
  });

  const resultado = await service.obtenerMiPerfil(usuario.id_usuario);

  assert.equal(resultado.id_usuario, usuario.id_usuario);
  assert.equal(resultado.estado, 'ACTIVO');
  assert.equal(resultado.nombre, null);
  assert.equal(resultado.apellidos, null);
  assert.equal(Object.hasOwn(resultado, 'password_hash'), false);
  assert.equal(Object.hasOwn(resultado, 'google_sub'), false);
});

test('obtenerMiPerfil: detecta la inactivación entre dos consultas', async () => {
  let usuarioActual = crearUsuario();

  const service = new UsuariosService({
    async findById() {
      return usuarioActual;
    },
  });

  const primerPerfil = await service.obtenerMiPerfil(
    usuarioActual.id_usuario,
  );

  assert.equal(primerPerfil.estado, 'ACTIVO');

  // Simula que un administrador inactiva la cuenta posteriormente.
  usuarioActual = {
    ...usuarioActual,
    estado: 'INACTIVO',
  };

  await assert.rejects(
    () => service.obtenerMiPerfil(usuarioActual.id_usuario),
    comprobarAccesoRechazado,
  );
});

test('obtenerMiPerfil: propaga errores del repositorio sin convertirlos en errores de autenticación', async () => {
  const errorOriginal = new Error('Fallo simulado de PostgreSQL');

  const service = new UsuariosService({
    async findById() {
      throw errorOriginal;
    },
  });

  await assert.rejects(
    () =>
      service.obtenerMiPerfil(
        '10000000-0000-4000-8000-000000000001',
      ),
    (error) => {
      // Una caída de PostgreSQL no significa credenciales incorrectas.
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});