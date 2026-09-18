require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  conAplicacionReal,
} = require('../helpers/con-aplicacion-real.cjs');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  PasswordService,
} = require('../../dist/modules/auth/services/password.service');

const {
  JwtService,
} = require('@nestjs/jwt');

const {
  AUTH_COOKIE_NAME,
} = require('../../dist/modules/auth/auth-cookie.config');

/**
 * Comprueba el cambio de contraseña y la invalidación de sesiones
 * mediante HTTP, JWT, Argon2 y PostgreSQL reales.
 *
 * Verifica que los intentos rechazados no modifiquen la cuenta.
 * Crea y elimina exclusivamente una cuenta de prueba.
 */
test('contraseña: invalida el token anterior y permite iniciar sesión con la nueva', async () => {
  await conAplicacionReal(async ({ app, baseUrl, origen }) => {
    const database = app.get(DatabaseService);
    const passwords = app.get(PasswordService);
    const jwtService = app.get(JwtService);

    const id = randomUUID();
    const correo = `${id}@example.invalid`;

    const passwordAnterior = 'Mi contraseña anterior de prueba';
    const passwordNueva = 'Mi contraseña nueva de prueba';
    const hashAnterior = await passwords.generarHash(passwordAnterior);

    async function login(password) {
      return fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          Origin: origen,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ correo, password }),
      });
    }

    async function cambiarPassword(cookie, actual, nueva) {
      return fetch(`${baseUrl}/api/auth/cambiar-password`, {
        method: 'POST',
        headers: {
          Origin: origen,
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        body: JSON.stringify({
          password_actual: actual,
          password_nueva: nueva,
        }),
      });
    }

    function obtenerCookie(response) {
      const encabezado = response.headers.get('set-cookie');
      assert.ok(encabezado);
      return encabezado.split(';')[0];
    }

    async function consultarPerfil(cookie) {
      return fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: cookie },
      });
    }

    async function consultarCuenta() {
      const resultado = await database.query(
        `
          SELECT password_hash, version_sesion
          FROM obra.usuarios
          WHERE id_usuario = $1
        `,
        [id],
      );

      return resultado.rows[0];
    }

    try {
      await database.query(
        `
          INSERT INTO obra.usuarios (
            id_usuario, correo, password_hash, nombre
          )
          VALUES ($1, $2, $3, 'Persona de prueba')
        `,
        [id, correo, hashAnterior],
      );

      assert.equal((await consultarCuenta()).version_sesion, 0);

      // Login inicial y acceso mediante un token versionado.
      const inicial = await login(passwordAnterior);
      assert.equal(inicial.status, 200);
      await inicial.json();

      const cookieAnterior = obtenerCookie(inicial);

      const perfilInicial = await consultarPerfil(cookieAnterior);
      assert.equal(perfilInicial.status, 200);
      assert.equal((await perfilInicial.json()).id_usuario, id);

      // Los tokens antiguos sin versión deben rechazarse,
      // aunque su firma y vencimiento sean válidos.
      /*
       * Construimos deliberadamente un token antiguo para comprobar
       * su rechazo. El servicio de producción ya no permite emitirlo.
       */
      const tokenSinVersion = await jwtService.signAsync({
        sub: id,
      });

      const sinVersion = await consultarPerfil(
        `${AUTH_COOKIE_NAME}=${tokenSinVersion}`,
      );

      assert.equal(sinVersion.status, 401);
      await sinVersion.json();

      const antesDelCambio = await consultarCuenta();

      // Una contraseña actual incorrecta no modifica la cuenta
      // ni elimina la cookie del navegador.
      const incorrecta = await cambiarPassword(
        cookieAnterior,
        'Contraseña incorrecta de prueba',
        passwordNueva,
      );

      assert.equal(incorrecta.status, 401);
      assert.equal(incorrecta.headers.get('set-cookie'), null);
      await incorrecta.json();

      assert.deepEqual(
        await consultarCuenta(),
        antesDelCambio,
      );

      // El fallo de comprobación no invalida la sesión existente.
      const sesionConservada = await consultarPerfil(cookieAnterior);
      assert.equal(sesionConservada.status, 200);
      await sesionConservada.json();

      // Reutilizar la contraseña tampoco modifica hash ni versión.
      const repetida = await cambiarPassword(
        cookieAnterior,
        passwordAnterior,
        passwordAnterior,
      );

      assert.equal(repetida.status, 400);
      assert.equal(repetida.headers.get('set-cookie'), null);
      await repetida.json();

      assert.deepEqual(
        await consultarCuenta(),
        antesDelCambio,
      );

      // Cambio completo mediante controlador, guards, DTO y servicio reales.
      const cambio = await cambiarPassword(
        cookieAnterior,
        passwordAnterior,
        passwordNueva,
      );

      assert.equal(cambio.status, 204);
      assert.equal(cambio.headers.get('cache-control'), 'no-store');
      assert.equal(await cambio.text(), '');

      const cookieEliminada = cambio.headers.get('set-cookie');
      assert.ok(cookieEliminada);

      assert.equal(
        cookieEliminada.split(';')[0],
        `${AUTH_COOKIE_NAME}=`,
      );

      assert.match(cookieEliminada, /HttpOnly/i);
      assert.match(cookieEliminada, /SameSite=Strict/i);
      assert.match(cookieEliminada, /Path=\//i);

      const vencimiento = /Expires=([^;]+)/i.exec(cookieEliminada);
      assert.ok(vencimiento);
      assert.ok(Date.parse(vencimiento[1]) < Date.now());

      const cuenta = await consultarCuenta();

      assert.equal(cuenta.version_sesion, 1);
      assert.notEqual(cuenta.password_hash, hashAnterior);

      assert.equal(
        await passwords.verificar(passwordNueva, cuenta.password_hash),
        true,
      );

      assert.equal(
        await passwords.verificar(passwordAnterior, cuenta.password_hash),
        false,
      );

      // La sesión emitida antes del cambio ya no autoriza solicitudes.
      const sesionAnterior = await consultarPerfil(cookieAnterior);
      assert.equal(sesionAnterior.status, 401);
      await sesionAnterior.json();

      // La contraseña anterior tampoco permite un nuevo login.
      const loginAnterior = await login(passwordAnterior);
      assert.equal(loginAnterior.status, 401);
      await loginAnterior.json();

      // La contraseña nueva permite emitir una sesión vigente.
      const loginNuevo = await login(passwordNueva);
      assert.equal(loginNuevo.status, 200);

      const perfilLogin = await loginNuevo.json();

      assert.equal(perfilLogin.id_usuario, id);
      assert.equal(Object.hasOwn(perfilLogin, 'version_sesion'), false);
      assert.equal(Object.hasOwn(perfilLogin, 'password_hash'), false);

      const cookieNueva = obtenerCookie(loginNuevo);

      const perfilNuevo = await consultarPerfil(cookieNueva);
      assert.equal(perfilNuevo.status, 200);
      assert.equal((await perfilNuevo.json()).id_usuario, id);

      // Un nuevo login no modifica la versión ni reactiva el token anterior.
      assert.equal((await consultarCuenta()).version_sesion, 1);

      const antiguoOtraVez = await consultarPerfil(cookieAnterior);
      assert.equal(antiguoOtraVez.status, 401);
      await antiguoOtraVez.json();
    } finally {
      await database.query(
        'DELETE FROM obra.usuarios WHERE id_usuario = $1',
        [id],
      );
    }
  });
});