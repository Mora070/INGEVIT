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

/**
 * Comprueba el perfil mediante sesión, guards, DTO, servicio
 * y PostgreSQL reales.
 *
 * Crea dos cuentas propias y las elimina al finalizar.
 * No modifica cuentas existentes ni necesita Mailpit.
 */
test('perfil HTTP: persiste cambios de la sesión y protege otras cuentas', async () => {
  await conAplicacionReal(async ({ app, baseUrl, origen }) => {
    const database = app.get(DatabaseService);

    // PasswordService utiliza Argon2 real.
    const passwords = app.get(PasswordService);
    const password = 'Clave temporal de perfil-2026';
    const hash = await passwords.generarHash(password);

    const usuario = randomUUID();
    const otroUsuario = randomUUID();

    try {
      await database.withTransaction(async (client) => {
        for (const id of [usuario, otroUsuario]) {
          await client.query(
            `
              INSERT INTO obra.usuarios (
                id_usuario, correo, password_hash,
                nombre, apellidos, telefono, ubicacion
              )
              VALUES (
                $1, $2, $3,
                'Nombre inicial', 'Apellidos iniciales',
                '+57 300 000 0000', 'Bogotá'
              )
            `,
            [id, `${id}@example.invalid`, hash],
          );
        }
      });

      async function consultarUsuario(id) {
        const resultado = await database.query(
          'SELECT * FROM obra.usuarios WHERE id_usuario = $1',
          [id],
        );

        return resultado.rows[0];
      }

      async function iniciarSesion(id) {
        const response = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            Origin: origen,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            correo: `${id}@example.invalid`,
            password,
          }),
        });

        assert.equal(response.status, 200);
        await response.json();

        const setCookie = response.headers.get('set-cookie');
        assert.ok(setCookie);

        return setCookie.split(';')[0];
      }

      async function actualizar(cookie, body) {
        return fetch(`${baseUrl}/api/usuarios/me/perfil`, {
          method: 'PATCH',
          headers: {
            Origin: origen,
            'Content-Type': 'application/json',
            Cookie: cookie,
          },
          body: JSON.stringify(body),
        });
      }

      async function obtenerPerfil(cookie) {
        const response = await fetch(`${baseUrl}/api/auth/me`, {
          headers: { Cookie: cookie },
        });

        assert.equal(response.status, 200);
        return response.json();
      }

      const inicial = await consultarUsuario(usuario);
      const otroInicial = await consultarUsuario(otroUsuario);

      const cookie = await iniciarSesion(usuario);
      const otraCookie = await iniciarSesion(otroUsuario);

      // Actualización parcial con normalización y eliminación explícita.
      const response = await actualizar(cookie, {
        nombre: '  Ana María  ',
        telefono: null,
        ubicacion: '  Medellín, Colombia  ',
      });

      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('set-cookie'), null);

      const perfilActualizado = await response.json();

      assert.deepEqual(perfilActualizado, {
        id_usuario: usuario,
        nombre: 'Ana María',
        apellidos: 'Apellidos iniciales',
        foto_perfil_url: inicial.foto_perfil_url,
        correo: inicial.correo,
        telefono: null,
        fecha_creacion: inicial.fecha_creacion.toISOString(),
        ubicacion: 'Medellín, Colombia',
        rol: inicial.rol,
        estado: inicial.estado,
      });

      // Comprobación directa de persistencia y campos no modificables.
      const guardado = await consultarUsuario(usuario);

      assert.deepEqual(guardado, {
        ...inicial,
        nombre: 'Ana María',
        telefono: null,
        ubicacion: 'Medellín, Colombia',
      });

      // La misma sesión debe consultar ahora los datos actualizados.
      assert.deepEqual(
        await obtenerPerfil(cookie),
        perfilActualizado,
      );

      // Otra cuenta permanece intacta y conserva su propia identidad.
      assert.deepEqual(
        await consultarUsuario(otroUsuario),
        otroInicial,
      );

      const otroPerfil = await obtenerPerfil(otraCookie);

      assert.equal(otroPerfil.id_usuario, otroUsuario);
      assert.equal(otroPerfil.nombre, 'Nombre inicial');

      // El cliente no puede seleccionar otra identidad desde el cuerpo.
      const intentoAjeno = await actualizar(cookie, {
        id_usuario: otroUsuario,
        nombre: 'Cambio no autorizado',
      });

      assert.equal(intentoAjeno.status, 400);
      await intentoAjeno.json();

      assert.deepEqual(await consultarUsuario(usuario), guardado);
      assert.deepEqual(
        await consultarUsuario(otroUsuario),
        otroInicial,
      );

      // La sesión deja de permitir cambios al inactivar la cuenta.
      await database.query(
        `
          UPDATE obra.usuarios
          SET estado = 'INACTIVO'
          WHERE id_usuario = $1
        `,
        [usuario],
      );

      const intentoInactivo = await actualizar(cookie, {
        nombre: 'Cambio que no debe guardarse',
      });

      assert.equal(intentoInactivo.status, 401);
      await intentoInactivo.json();

      assert.deepEqual(await consultarUsuario(usuario), {
        ...guardado,
        estado: 'INACTIVO',
      });
    } finally {
      await database.query(
        'DELETE FROM obra.usuarios WHERE id_usuario = ANY($1::uuid[])',
        [[usuario, otroUsuario]],
      );
    }
  });
});