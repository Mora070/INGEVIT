require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { UnauthorizedException } = require('@nestjs/common');

const {
  AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');

const {
  AUTH_COOKIE_NAME,
} = require('../dist/modules/auth/auth-cookie.config');

const ID_USUARIO = '10000000-0000-4000-8000-000000000001';
const TOKEN = 'TOKEN_FICTICIO_PARA_PRUEBAS';

function crearPerfil() {
  return {
    id_usuario: ID_USUARIO,
    nombre: 'Persona',
    apellidos: 'De prueba',
    foto_perfil_url: null,
    correo: 'persona@example.test',
    telefono: null,
    fecha_creacion: '2026-09-08T10:30:00.000Z',
    ubicacion: null,
    rol: 'USUARIO',
    estado: 'ACTIVO',
  };
}

/**
 * Simula las dependencias del guard.
 *
 * Registra el orden de las operaciones para comprobar que
 * PostgreSQL se consulta únicamente después de verificar el token.
 */
function crearEscenario({ errorToken, errorPerfil } = {}) {
  const llamadas = [];
  const perfil = crearPerfil();

  const tokenService = {
    async verificarToken(token) {
      llamadas.push({ operacion: 'verificarToken', valor: token });

      if (errorToken) {
        throw errorToken;
      }

      return ID_USUARIO;
    },
  };

  const usuariosService = {
    async obtenerMiPerfil(idUsuario) {
      llamadas.push({
        operacion: 'obtenerMiPerfil',
        valor: idUsuario,
      });

      if (errorPerfil) {
        throw errorPerfil;
      }

      return perfil;
    },
  };

  return {
    guard: new AuthGuard(tokenService, usuariosService),
    llamadas,
    perfil,
  };
}

function crearContexto(request) {
  return {
    switchToHttp() {
      return {
        getRequest() {
          return request;
        },
      };
    },
  };
}

function comprobarSesionRechazada(error) {
  assert.ok(error instanceof UnauthorizedException);
  assert.equal(error.getStatus(), 401);
  assert.equal(
    error.message,
    'La sesión no es válida o ha expirado.',
  );

  return true;
}

test('AuthGuard: verifica el token antes de consultar y asignar el perfil', async () => {
  const { guard, llamadas, perfil } = crearEscenario();

  const request = {
    cookies: { [AUTH_COOKIE_NAME]: TOKEN },
  };

  const permitido = await guard.canActivate(crearContexto(request));

  assert.equal(permitido, true);
  assert.strictEqual(request.usuario, perfil);

  assert.deepEqual(llamadas, [
    { operacion: 'verificarToken', valor: TOKEN },
    { operacion: 'obtenerMiPerfil', valor: ID_USUARIO },
  ]);
});

test('AuthGuard: rechaza un contenedor de cookies ausente o inválido', async () => {
  for (const cookies of [undefined, null, 'texto', []]) {
    const { guard, llamadas } = crearEscenario();
    const request = { cookies };

    await assert.rejects(
      () => guard.canActivate(crearContexto(request)),
      comprobarSesionRechazada,
    );

    assert.deepEqual(llamadas, []);
    assert.equal(Object.hasOwn(request, 'usuario'), false);
  }
});

test('AuthGuard: rechaza una cookie de acceso ausente, vacía o de tipo incorrecto', async () => {
  const valoresInvalidos = [
    undefined,
    '',
    null,
    123,
    true,
    {},
    [TOKEN],
  ];

  for (const valor of valoresInvalidos) {
    const { guard, llamadas } = crearEscenario();

    const request = {
      cookies: { [AUTH_COOKIE_NAME]: valor },
    };

    await assert.rejects(
      () => guard.canActivate(crearContexto(request)),
      comprobarSesionRechazada,
    );

    assert.deepEqual(llamadas, []);
    assert.equal(Object.hasOwn(request, 'usuario'), false);
  }
});

test('AuthGuard: no consulta el perfil si el token es rechazado', async () => {
  const errorOriginal = new UnauthorizedException(
    'La sesión no es válida o ha expirado.',
  );

  const { guard, llamadas } = crearEscenario({
    errorToken: errorOriginal,
  });

  const request = {
    cookies: { [AUTH_COOKIE_NAME]: TOKEN },
  };

  await assert.rejects(
    () => guard.canActivate(crearContexto(request)),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );

  assert.deepEqual(llamadas, [
    { operacion: 'verificarToken', valor: TOKEN },
  ]);

  assert.equal(Object.hasOwn(request, 'usuario'), false);
});

test('AuthGuard: rechaza una cuenta no disponible aunque el token sea válido', async () => {
  /**
   * UsuariosService ya comprueba si la cuenta existe y está activa.
   * Aquí verificamos que el guard respeta ese rechazo.
   */
  const errorOriginal = new UnauthorizedException(
    'La sesión no es válida o la cuenta no está activa.',
  );

  const { guard, llamadas } = crearEscenario({
    errorPerfil: errorOriginal,
  });

  const request = {
    cookies: { [AUTH_COOKIE_NAME]: TOKEN },
  };

  await assert.rejects(
    () => guard.canActivate(crearContexto(request)),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );

  assert.deepEqual(llamadas, [
    { operacion: 'verificarToken', valor: TOKEN },
    { operacion: 'obtenerMiPerfil', valor: ID_USUARIO },
  ]);

  assert.equal(Object.hasOwn(request, 'usuario'), false);
});

test('AuthGuard: propaga un fallo de PostgreSQL sin asignar una identidad', async () => {
  const errorOriginal = new Error('Fallo simulado de PostgreSQL');

  const { guard } = crearEscenario({
    errorPerfil: errorOriginal,
  });

  const request = {
    cookies: { [AUTH_COOKIE_NAME]: TOKEN },
  };

  await assert.rejects(
    () => guard.canActivate(crearContexto(request)),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );

  assert.equal(Object.hasOwn(request, 'usuario'), false);
});

test('AuthGuard: ignora identidades enviadas en el cuerpo o en encabezados', async () => {
  const { guard, llamadas, perfil } = crearEscenario();

  const request = {
    cookies: { [AUTH_COOKIE_NAME]: TOKEN },
    body: {
      id_usuario: '20000000-0000-4000-8000-000000000002',
      rol: 'ADMINISTRADOR',
    },
    headers: {
      'x-user-id': '30000000-0000-4000-8000-000000000003',
    },
    usuario: {
      id_usuario: '40000000-0000-4000-8000-000000000004',
      rol: 'ADMINISTRADOR',
    },
  };

  await guard.canActivate(crearContexto(request));

  assert.strictEqual(request.usuario, perfil);
  assert.deepEqual(llamadas, [
    { operacion: 'verificarToken', valor: TOKEN },
    { operacion: 'obtenerMiPerfil', valor: ID_USUARIO },
  ]);
});

test('AuthGuard: elimina una identidad previa cuando la autenticación falla', async () => {
  const { guard } = crearEscenario();

  const request = {
    cookies: {},
    usuario: crearPerfil(),
  };

  await assert.rejects(
    () => guard.canActivate(crearContexto(request)),
    comprobarSesionRechazada,
  );

  assert.equal(Object.hasOwn(request, 'usuario'), false);
});

test('AuthGuard: vuelve a consultar el perfil en cada solicitud', async () => {
  const { guard, llamadas } = crearEscenario();

  for (let numero = 0; numero < 2; numero += 1) {
    const request = {
      cookies: { [AUTH_COOKIE_NAME]: TOKEN },
    };

    assert.equal(
      await guard.canActivate(crearContexto(request)),
      true,
    );
  }

  assert.deepEqual(llamadas, [
    { operacion: 'verificarToken', valor: TOKEN },
    { operacion: 'obtenerMiPerfil', valor: ID_USUARIO },
    { operacion: 'verificarToken', valor: TOKEN },
    { operacion: 'obtenerMiPerfil', valor: ID_USUARIO },
  ]);
});