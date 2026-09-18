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
  TokenService,
} = require('../../dist/modules/auth/services/token.service');

const {
  RecuperacionCodigoRepository,
} = require('../../dist/modules/auth/recuperacion-codigo.repository');

const {
  generarCodigoRecuperacion,
  getRecuperacionSecret,
} = require('../../dist/modules/auth/utils/codigo-recuperacion');

const {
  AUTH_COOKIE_NAME,
} = require('../../dist/modules/auth/auth-cookie.config');

/**
 * Utiliza HTTP, validación, Argon2, JWT y PostgreSQL reales.
 * La emisión se realiza directamente para no depender de SMTP.
 */
test('recuperación HTTP: cambia la contraseña una sola vez e invalida las sesiones anteriores', async () => {
  await conAplicacionReal(async ({ app, baseUrl, origen }) => {
    const database = app.get(DatabaseService);
    const passwords = app.get(PasswordService);
    const tokens = app.get(TokenService);
    const repository = app.get(RecuperacionCodigoRepository);

    const id = randomUUID();
    const correo = `${id}@example.invalid`;
    const anterior = 'Contraseña anterior de integración';
    const nueva = 'Contraseña nueva de integración';
    const codigo = generarCodigoRecuperacion();

    async function post(ruta, datos) {
      return fetch(`${baseUrl}/api/auth/${ruta}`, {
        method: 'POST',
        headers: {
          Origin: origen,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(datos),
      });
    }

    async function esperarEstado(response, esperado) {
      const contenido = await response.text();
      assert.equal(response.status, esperado, contenido);
      return contenido;
    }

    try {
      const hashAnterior = await passwords.generarHash(anterior);

      await database.query(
        `
          INSERT INTO obra.usuarios (
            id_usuario, correo, password_hash
          )
          VALUES ($1, $2, $3)
        `,
        [id, correo, hashAnterior],
      );

      // Token de sesión JWT. Se mantiene sin cambios.
      const tokenSesion = await tokens.emitirTokenConVersion(id, 0);
      const cookieAnterior = `${AUTH_COOKIE_NAME}=${tokenSesion}`;

      await esperarEstado(
        await fetch(`${baseUrl}/api/auth/me`, {
          headers: { Cookie: cookieAnterior },
        }),
        200,
      );

      await database.withTransaction(async (client) => {
        assert.equal(
          await repository.emitir(
            client,
            correo,
            codigo,
            getRecuperacionSecret(),
          ),
          correo,
        );
      });

      // Una contraseña inválida no consume el enlace.
      await esperarEstado(
        await post('restablecer-password', {
          correo,
          codigo,
          password_nueva: 'corta',
        }),
        400,
      );

      // No permite introducir campos adicionales.
      await esperarEstado(
        await post('restablecer-password', {
          correo,
          codigo,
          password_nueva: nueva,
          rol: 'ADMINISTRADOR',
        }),
        400,
      );

      const antes = await database.query(
        `
          SELECT password_hash, version_sesion
          FROM obra.usuarios
          WHERE id_usuario = $1
        `,
        [id],
      );

      assert.equal(antes.rows[0].password_hash, hashAnterior);
      assert.equal(antes.rows[0].version_sesion, 0);

      const respuesta = await post('restablecer-password', {
        correo,
        codigo,
        password_nueva: nueva,
      });

      assert.equal(respuesta.headers.get('cache-control'), 'no-store');
      assert.equal(respuesta.headers.get('set-cookie'), null);
      assert.equal(await esperarEstado(respuesta, 204), '');

      const despues = await database.query(
        `
          SELECT password_hash, version_sesion
          FROM obra.usuarios
          WHERE id_usuario = $1
        `,
        [id],
      );

      assert.equal(despues.rows[0].version_sesion, 1);
      assert.notEqual(despues.rows[0].password_hash, hashAnterior);
      assert.equal(
        await passwords.verificar(
          nueva,
          despues.rows[0].password_hash,
        ),
        true,
      );

      // El token de sesión emitido antes del cambio queda invalidado.
      await esperarEstado(
        await fetch(`${baseUrl}/api/auth/me`, {
          headers: { Cookie: cookieAnterior },
        }),
        401,
      );

      // El código ya utilizado no puede volver a cambiar la contraseña.
      await esperarEstado(
        await post('restablecer-password', {
          correo,
          codigo,
          password_nueva: 'Otra contraseña que no debe guardarse',
        }),
        400,
      );

      await esperarEstado(
        await post('login', {
          correo,
          password: anterior,
        }),
        401,
      );

      const loginNuevo = await post('login', {
        correo,
        password: nueva,
      });

      assert.equal(loginNuevo.status, 200);
      const setCookie = loginNuevo.headers.get('set-cookie');
      assert.ok(setCookie);
      await loginNuevo.text();

      await esperarEstado(
        await fetch(`${baseUrl}/api/auth/me`, {
          headers: { Cookie: setCookie.split(';')[0] },
        }),
        200,
      );

      const solicitudes = await database.query(
        `
          SELECT id_usuario
          FROM obra.recuperaciones_password
          WHERE id_usuario = $1
        `,
        [id],
      );

      assert.equal(solicitudes.rowCount, 0);
    } finally {
      // La solicitud, si permanece, se elimina por ON DELETE CASCADE.
      await database.query(
        'DELETE FROM obra.usuarios WHERE id_usuario = $1',
        [id],
      );
    }
  });
});