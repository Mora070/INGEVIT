require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const {
  ConflictException,
  UnauthorizedException,
} = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');

const {
  getDatabaseConfig,
} = require('../../dist/database/database.config');

const {
  UsuariosRepository,
} = require('../../dist/modules/usuarios/usuarios.repository');

const {
  UsuariosService,
} = require('../../dist/modules/usuarios/usuarios.service');

const {
  AuthService,
} = require('../../dist/modules/auth/auth.service');

const {
  PasswordService,
} = require('../../dist/modules/auth/services/password.service');

const {
  TokenService,
} = require('../../dist/modules/auth/services/token.service');

const {
  AuthGuard,
} = require('../../dist/modules/auth/guards/auth.guard');

const {
  getAuthConfig,
} = require('../../dist/modules/auth/auth.config');

const {
  AUTH_COOKIE_NAME,
} = require('../../dist/modules/auth/auth-cookie.config');

/**
 * El guard recibe un contexto HTTP mínimo.
 * Los servicios, Argon2, JWT y PostgreSQL son reales.
 */
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

function comprobarNoAutorizado(error) {
  assert.ok(error instanceof UnauthorizedException);
  assert.equal(error.getStatus(), 401);
  return true;
}

test('autenticación: registra, inicia sesión y respeta la inactivación de la cuenta', async () => {
  const pool = new Pool(getDatabaseConfig());

  pool.on('error', () => {
    console.error(
      'Se produjo un error en una conexión ociosa de la prueba.',
    );
    process.exitCode = 1;
  });

  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    /**
     * Todas las consultas usan esta conexión y su transacción.
     * No sustituimos los resultados del repositorio.
     */
    const repository = new UsuariosRepository({
      query(sql, values) {
        return client.query(sql, values);
      },
    });

    const usuariosService = new UsuariosService(repository);
    const passwordService = new PasswordService();

    // Clave temporal exclusiva de esta prueba. No utiliza AUTH_JWT_SECRET.
    const jwtService = new JwtService(
      getAuthConfig({
        AUTH_JWT_SECRET: randomBytes(32).toString('hex'),
      }),
    );

    const tokenService = new TokenService(jwtService);

    const authService = new AuthService(
      usuariosService,
      passwordService,
      tokenService,
    );

    const guard = new AuthGuard(tokenService, usuariosService);

    // La construcción manual requiere ejecutar este hook explícitamente.
    await authService.onModuleInit();

    const correo = `auth-${randomUUID()}@example.test`;
    const password = '  Clave ficticia de integración-Ñ  ';

    // 1. Registro real.
    const perfil = await authService.registrar({
      correo,
      password,
      nombre: 'Persona de integración',
    });

    assert.equal(perfil.correo, correo);
    assert.equal(perfil.rol, 'USUARIO');
    assert.equal(perfil.estado, 'ACTIVO');
    assert.equal(Object.hasOwn(perfil, 'password_hash'), false);
    assert.equal(Object.hasOwn(perfil, 'google_sub'), false);
    assert.equal(Object.hasOwn(perfil, 'tokenAcceso'), false);

    // Confirma que PostgreSQL almacena un hash verificable.
    const almacenado = await repository.findById(perfil.id_usuario);

    assert.ok(almacenado);
    assert.ok(almacenado.password_hash.startsWith('$argon2id$'));
    assert.notEqual(almacenado.password_hash, password);

    assert.equal(
      await passwordService.verificar(
        password,
        almacenado.password_hash,
      ),
      true,
    );

    // 2. Registro duplicado: debe conservar la cuenta original.
    await assert.rejects(
      () =>
        authService.registrar({
          correo: correo.toUpperCase(),
          password: 'Otra clave ficticia',
        }),
      (error) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(error.getStatus(), 409);
        return true;
      },
    );

    // 3. Login real: correo sin distinguir mayúsculas.
    const sesion = await authService.iniciarSesion(
      correo.toUpperCase(),
      password,
    );

    assert.equal(sesion.usuario.id_usuario, perfil.id_usuario);
    assert.equal(
      await tokenService.verificarToken(sesion.tokenAcceso),
      perfil.id_usuario,
    );

    // 4. Acceso mediante el guard y el token emitido.
    const request = {
      cookies: {
        [AUTH_COOKIE_NAME]: sesion.tokenAcceso,
      },
    };

    assert.equal(
      await guard.canActivate(crearContexto(request)),
      true,
    );
    assert.deepEqual(request.usuario, perfil);

    // 5. Una contraseña incorrecta no permite iniciar sesión.
    await assert.rejects(
      () =>
        authService.iniciarSesion(
          correo,
          'Contraseña incorrecta',
        ),
      comprobarNoAutorizado,
    );

    /**
     * 6. Cambiamos el estado únicamente de la cuenta temporal.
     * Es preparación de la prueba, no un endpoint administrativo.
     */
    await client.query(
      `
        UPDATE obra.usuarios
        SET estado = 'INACTIVO'
        WHERE id_usuario = $1::uuid
      `,
      [perfil.id_usuario],
    );

    // El JWT continúa siendo criptográficamente válido.
    assert.equal(
      await tokenService.verificarToken(sesion.tokenAcceso),
      perfil.id_usuario,
    );

    // Pero el estado actual de la cuenta impide usarlo.
    await assert.rejects(
      () => guard.canActivate(crearContexto(request)),
      comprobarNoAutorizado,
    );

    assert.equal(Object.hasOwn(request, 'usuario'), false);

    await assert.rejects(
      () => authService.iniciarSesion(correo, password),
      comprobarNoAutorizado,
    );

    // 7. Reactivación: vuelve a permitir un nuevo inicio de sesión.
    await client.query(
      `
        UPDATE obra.usuarios
        SET estado = 'ACTIVO'
        WHERE id_usuario = $1::uuid
      `,
      [perfil.id_usuario],
    );

    const nuevaSesion = await authService.iniciarSesion(
      correo,
      password,
    );

    assert.equal(nuevaSesion.usuario.estado, 'ACTIVO');

    const nuevaSolicitud = {
      cookies: {
        [AUTH_COOKIE_NAME]: nuevaSesion.tokenAcceso,
      },
    };

    assert.equal(
      await guard.canActivate(crearContexto(nuevaSolicitud)),
      true,
    );
  } finally {
    try {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } finally {
          client.release(true);
        }
      }
    } finally {
      await pool.end();
    }
  }
});