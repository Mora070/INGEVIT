require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { UnauthorizedException } = require('@nestjs/common');

const {
  GoogleAuthService,
} = require('../dist/modules/auth/services/google-auth.service');

const IDENTIDAD = {
  sub: 'google-prueba',
  correo: 'persona@example.invalid',
  nombre: 'Ana',
  apellidos: 'Pérez',
};

const USUARIO = {
  id_usuario: '10000000-0000-4000-8000-000000000001',
  nombre: 'Ana',
  apellidos: 'Pérez',
  foto_perfil_url: null,
  correo: 'persona@example.invalid',
  telefono: null,
  password_hash: null,
  fecha_creacion: new Date('2026-09-17T12:00:00Z'),
  ubicacion: null,
  rol: 'USUARIO',
  estado: 'ACTIVO',
  google_sub: 'google-prueba',
  version_sesion: 4,
};

/**
 * Comprueba la coordinación.
 * La criptografía de Google y PostgreSQL se prueban por separado.
 */
function preparar({ usuario = USUARIO, errorIdentidad } = {}) {
  const operaciones = [];

  const identidades = {
    async verificar(credential) {
      assert.equal(credential, 'credencial-simulada');
      operaciones.push('verificar');

      if (errorIdentidad) throw errorIdentidad;

      return IDENTIDAD;
    },
  };

  const cuentas = {
    async obtenerOCrear(identidad) {
      assert.strictEqual(identidad, IDENTIDAD);
      operaciones.push('cuenta');
      return usuario;
    },
  };

  const tokens = {
    async emitirTokenConVersion(id, version) {
      assert.equal(id, USUARIO.id_usuario);
      assert.equal(version, USUARIO.version_sesion);
      operaciones.push('sesion');
      return 'token-interno-simulado';
    },
  };

  return {
    servicio: new GoogleAuthService(identidades, cuentas, tokens),
    operaciones,
  };
}

test('Google autenticación: emite la sesión con la versión vigente y un perfil seguro', async () => {
  const contexto = preparar();

  const resultado = await contexto.servicio.iniciarSesion(
    'credencial-simulada',
  );

  assert.equal(resultado.tokenAcceso, 'token-interno-simulado');

  assert.deepEqual(resultado.usuario, {
    id_usuario: USUARIO.id_usuario,
    nombre: 'Ana',
    apellidos: 'Pérez',
    foto_perfil_url: null,
    correo: 'persona@example.invalid',
    telefono: null,
    fecha_creacion: '2026-09-17T12:00:00.000Z',
    ubicacion: null,
    rol: 'USUARIO',
    estado: 'ACTIVO',
  });

  assert.deepEqual(contexto.operaciones, [
    'verificar', 'cuenta', 'sesion',
  ]);
});

test('Google autenticación: una identidad rechazada no consulta cuentas ni emite sesión', async () => {
  const esperado = new UnauthorizedException('Credencial rechazada');
  const contexto = preparar({ errorIdentidad: esperado });

  await assert.rejects(
    () => contexto.servicio.iniciarSesion('credencial-simulada'),
    (error) => error === esperado,
  );

  assert.deepEqual(contexto.operaciones, ['verificar']);
});

test('Google autenticación: un conflicto de cuenta no emite sesión', async () => {
  const contexto = preparar({ usuario: null });

  await assert.rejects(
    () => contexto.servicio.iniciarSesion('credencial-simulada'),
    (error) => error.getStatus?.() === 409,
  );

  assert.deepEqual(contexto.operaciones, ['verificar', 'cuenta']);
});

test('Google autenticación: rechaza cuentas inactivas sin emitir sesión', async () => {
  const contexto = preparar({
    usuario: { ...USUARIO, estado: 'INACTIVO' },
  });

  await assert.rejects(
    () => contexto.servicio.iniciarSesion('credencial-simulada'),
    (error) => error.getStatus?.() === 401,
  );

  assert.deepEqual(contexto.operaciones, ['verificar', 'cuenta']);
});