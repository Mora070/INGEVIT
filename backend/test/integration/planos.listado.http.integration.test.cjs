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
  AUTH_COOKIE_NAME,
} = require('../../dist/modules/auth/auth-cookie.config');

test(
  'planos HTTP: aplica permisos, pagina en orden estable y respeta la retirada de acceso',
  async () => {
    await conAplicacionReal(async ({ app, baseUrl, origen }) => {
      const database = app.get(DatabaseService);
      const passwords = app.get(PasswordService);

      const propietario = randomUUID();
      const colaborador = randomUUID();
      const administrador = randomUUID();

      const proyecto = randomUUID();
      const otroProyecto = randomUUID();

      const usuarios = [propietario, colaborador, administrador];
      const proyectos = [proyecto, otroProyecto];

      const idsPlanos = [randomUUID(), randomUUID(), randomUUID()];
      const ordenEsperado = [...idsPlanos].sort().reverse();

      const password = 'Clave temporal de integración-2026';
      const hash = await passwords.generarHash(password);

      try {
        await database.withTransaction(async (client) => {
          for (const id of usuarios) {
            await client.query(
              `
                INSERT INTO obra.usuarios (
                  id_usuario, correo, password_hash, rol
                )
                VALUES ($1, $2, $3, $4)
              `,
              [
                id,
                `${id}@example.invalid`,
                hash,
                id === administrador ? 'ADMINISTRADOR' : 'USUARIO',
              ],
            );
          }

          for (const id of proyectos) {
            await client.query(
              `
                INSERT INTO obra.proyectos (
                  id_proyecto, id_propietario, nombre, descripcion,
                  direccion, contratante, fecha_inicio, estado_proyecto
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              `,
              [
                id,
                propietario,
                'Proyecto de integración',
                'Prueba de listado de planos',
                'Dirección temporal',
                'Contratante temporal',
                '2026-09-14',
                'ACTIVA',
              ],
            );
          }

          await client.query(
            `
              INSERT INTO obra.usuario_proyecto (
                id_usuario, id_proyecto
              )
              VALUES ($1, $2)
            `,
            [colaborador, proyecto],
          );

          /*
           * Todos tienen la misma fecha para comprobar que id_plano
           * resuelve los empates de manera estable.
           *
           * El plano del segundo proyecto no debe aparecer en el listado.
           */
          for (const [idPlano, idProyecto] of [
            ...idsPlanos.map((id) => [id, proyecto]),
            [randomUUID(), otroProyecto],
          ]) {
            await client.query(
              `
                INSERT INTO obra.planos (
                  id_plano, id_proyecto, id_usuario_subida,
                  titulo, descripcion, url, s3_key, fecha_subida, numero_paginas
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
              `,
              [
                idPlano,
                idProyecto,
                propietario,
                `Plano ${idPlano}`,
                'Descripción de integración',
                '/plano-temporal.pdf',
                `planos/${randomUUID()}.pdf`,
                '2026-09-14T12:00:00.000Z',
              ],
            );
          }
        });

        async function iniciarSesion(idUsuario) {
          const respuesta = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: {
              Origin: origen,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              correo: `${idUsuario}@example.invalid`,
              password,
            }),
          });

          await respuesta.json();
          assert.equal(respuesta.status, 200);

          const cookie = respuesta.headers
            .getSetCookie()
            .find((valor) =>
              valor.startsWith(`${AUTH_COOKIE_NAME}=`),
            );

          assert.ok(cookie);
          return cookie.split(';')[0];
        }

        const cookieColaborador = await iniciarSesion(colaborador);
        const cookiePropietario = await iniciarSesion(propietario);
        const cookieAdministrador = await iniciarSesion(administrador);

        const ruta = `${baseUrl}/api/proyectos/${proyecto}/planos`;

        async function consultar(cookie, consulta = '') {
          const respuesta = await fetch(`${ruta}${consulta}`, {
            headers: cookie ? { Cookie: cookie } : {},
          });

          return {
            status: respuesta.status,
            cache: respuesta.headers.get('cache-control'),
            cuerpo: await respuesta.json(),
          };
        }

        // La ruta exige autenticación real.
        assert.equal((await consultar()).status, 401);

        const primera = await consultar(
          cookieColaborador,
          '?pagina=1&limite=2',
        );

        assert.equal(primera.status, 200);
        assert.equal(primera.cache, 'no-store');
        assert.equal(primera.cuerpo.total, 3);
        assert.equal(primera.cuerpo.total_paginas, 2);
        assert.equal(primera.cuerpo.pagina, 1);
        assert.equal(primera.cuerpo.limite, 2);

        assert.deepEqual(
          primera.cuerpo.planos.map((plano) => plano.id_plano),
          ordenEsperado.slice(0, 2),
        );

        for (const plano of primera.cuerpo.planos) {
          assert.equal(plano.id_proyecto, proyecto);
          assert.equal(plano.descripcion, 'Descripción de integración');
          assert.equal(plano.mime_type, 'application/pdf');
          assert.equal(plano.fecha_subida, '2026-09-14T12:00:00.000Z');
          assert.equal(Object.hasOwn(plano, 's3_key'), false);
        }

        const segunda = await consultar(
          cookieColaborador,
          '?pagina=2&limite=2',
        );

        assert.equal(segunda.status, 200);
        assert.deepEqual(
          segunda.cuerpo.planos.map((plano) => plano.id_plano),
          ordenEsperado.slice(2),
        );

        const vacia = await consultar(
          cookieColaborador,
          '?pagina=99&limite=2',
        );

        assert.equal(vacia.status, 200);
        assert.equal(vacia.cuerpo.total, 3);
        assert.deepEqual(vacia.cuerpo.planos, []);

        // La validación HTTP rechaza parámetros no permitidos.
        assert.equal(
          (await consultar(cookieColaborador, '?limite=101')).status,
          400,
        );

        assert.equal(
          (await consultar(cookieColaborador, '?extra=1')).status,
          400,
        );

        // Ser administrador global no concede acceso al proyecto.
        assert.equal(
          (await consultar(cookieAdministrador)).status,
          404,
        );

        // El propietario conserva acceso.
        assert.equal(
          (await consultar(cookiePropietario)).status,
          200,
        );

        await database.query(
          `
            DELETE FROM obra.usuario_proyecto
            WHERE id_usuario = $1 AND id_proyecto = $2
          `,
          [colaborador, proyecto],
        );

        assert.equal(
          (await consultar(cookieColaborador)).status,
          404,
        );

        // La inactividad del proyecto bloquea también al propietario.
        await database.query(
          `
            UPDATE obra.proyectos
            SET activo = FALSE
            WHERE id_proyecto = $1
          `,
          [proyecto],
        );

        assert.equal(
          (await consultar(cookiePropietario)).status,
          404,
        );
      } finally {
        await database.withTransaction(async (client) => {
          await client.query(
            `
              DELETE FROM obra.proyectos
              WHERE id_proyecto = ANY($1::uuid[])
            `,
            [proyectos],
          );

          await client.query(
            `
              DELETE FROM obra.usuarios
              WHERE id_usuario = ANY($1::uuid[])
            `,
            [usuarios],
          );
        });
      }
    });
  },
);