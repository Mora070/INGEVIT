require('reflect-metadata');

const { test } = require('node:test');
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

/**
 * Comprueba el historial con autenticación, trigger y PostgreSQL reales.
 * Los registros pertenecen exclusivamente a esta prueba.
 */
test('notificaciones HTTP: separa receptores, pagina y aplica el acceso actual', async () => {
  await conAplicacionReal(async ({ app, baseUrl, origen }) => {
    const database = app.get(DatabaseService);
    const passwords = app.get(PasswordService);

    const propietario = randomUUID();
    const colaborador = randomUUID();
    const proyecto = randomUUID();
    const plano = randomUUID();
    const incidencias = [randomUUID(), randomUUID()];

    const password = 'Clave temporal de integración-2026';
    const hash = await passwords.generarHash(password);

    try {
      await database.withTransaction(async (client) => {
        for (const id of [propietario, colaborador]) {
          await client.query(
            `
              INSERT INTO obra.usuarios (
                id_usuario, correo, password_hash
              )
              VALUES ($1, $2, $3)
            `,
            [id, `${id}@example.invalid`, hash],
          );
        }

        await client.query(
          `
            INSERT INTO obra.proyectos (
              id_proyecto, id_propietario, nombre, descripcion,
              direccion, contratante, fecha_inicio, estado_proyecto
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            proyecto,
            propietario,
            'Proyecto temporal',
            'Historial de notificaciones',
            'Dirección temporal',
            'Contratante temporal',
            '2026-09-16',
            'ACTIVA',
          ],
        );

        await client.query(
          `
            INSERT INTO obra.usuario_proyecto (
              id_usuario, id_proyecto
            )
            VALUES ($1, $2)
          `,
          [colaborador, proyecto],
        );

        await client.query(
          `
            INSERT INTO obra.planos (
              id_plano, id_proyecto, id_usuario_subida,
              titulo, descripcion, url, s3_key, numero_paginas
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
          `,
          [
            plano,
            proyecto,
            propietario,
            'Plano temporal',
            '',
            '/plano-temporal.pdf',
            `planos/${randomUUID()}.pdf`,
          ],
        );

        /*
         * El propietario crea ambas incidencias.
         * El trigger debe notificar al colaborador, no al propietario.
         * Al compartir transacción, las fechas empatan.
         */
        for (const id of incidencias) {
          await client.query(
            `
              INSERT INTO obra.incidencias (
                id_incidencia, id_plano, id_proyecto, id_creador,
                titulo, descripcion, estado, prioridad,
                numero_pagina, coordenada_x, coordenada_y
              )
              VALUES (
                $1, $2, $3, $4, $5, $6,
                'PENDIENTE', 'MEDIA', 1, 0.5, 0.5
              )
            `,
            [
              id,
              plano,
              proyecto,
              propietario,
              `Incidencia ${id}`,
              'Descripción temporal',
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
          .find((valor) => valor.startsWith(`${AUTH_COOKIE_NAME}=`));

        assert.ok(cookie);
        return cookie.split(';')[0];
      }

      const cookieColaborador = await iniciarSesion(colaborador);
      const cookiePropietario = await iniciarSesion(propietario);

      async function consultar(cookie, parametros = '') {
        const respuesta = await fetch(
          `${baseUrl}/api/notificaciones${parametros}`,
          { headers: cookie ? { Cookie: cookie } : {} },
        );

        return {
          status: respuesta.status,
          cache: respuesta.headers.get('cache-control'),
          cuerpo: await respuesta.json(),
        };
      }

      assert.equal((await consultar()).status, 401);

      const registros = await database.query(
        `
          SELECT *
          FROM obra.notificaciones
          WHERE id_receptor = $1
          ORDER BY fecha_creacion DESC, id_notificacion DESC
        `,
        [colaborador],
      );

      assert.equal(registros.rows.length, 2);
      assert.equal(
        registros.rows[0].fecha_creacion.toISOString(),
        registros.rows[1].fecha_creacion.toISOString(),
      );

      const esperadas = registros.rows.map((fila) => ({
        id_notificacion: fila.id_notificacion,
        id_actor: propietario,
        id_proyecto: proyecto,
        id_incidencia: fila.id_incidencia,
        tipo: 'INCIDENCIA_CREADA',
        titulo: 'Incidencia creada',
        mensaje: `Incidencia ${fila.id_incidencia}`,
        fecha_creacion: fila.fecha_creacion.toISOString(),
      }));

      const primera = await consultar(
        cookieColaborador,
        '?pagina=1&limite=1',
      );

      assert.equal(primera.status, 200);
      assert.equal(primera.cache, 'no-store');
      assert.deepEqual(primera.cuerpo, {
        notificaciones: [esperadas[0]],
        pagina: 1,
        limite: 1,
        total: 2,
        total_paginas: 2,
      });

      const segunda = await consultar(
        cookieColaborador,
        '?pagina=2&limite=1',
      );

      assert.equal(segunda.status, 200);
      assert.deepEqual(segunda.cuerpo.notificaciones, [esperadas[1]]);

      const vacia = await consultar(
        cookieColaborador,
        '?pagina=3&limite=1',
      );

      assert.equal(vacia.status, 200);
      assert.deepEqual(vacia.cuerpo, {
        notificaciones: [],
        pagina: 3,
        limite: 1,
        total: 2,
        total_paginas: 2,
      });

      // La propiedad del proyecto no permite leer el historial de otro receptor.
      const historialPropietario = await consultar(cookiePropietario);

      assert.equal(historialPropietario.status, 200);
      assert.equal(historialPropietario.cuerpo.total, 0);
      assert.deepEqual(historialPropietario.cuerpo.notificaciones, []);

      assert.equal(
        (await consultar(
          cookiePropietario,
          `?id_receptor=${colaborador}`,
        )).status,
        400,
      );

      // La notificación se conserva al eliminar la incidencia.
      const incidenciaEliminada = esperadas[0].id_incidencia;

      await database.query(
        'DELETE FROM obra.incidencias WHERE id_incidencia = $1',
        [incidenciaEliminada],
      );

      const trasEliminar = await consultar(cookieColaborador);

      assert.equal(trasEliminar.status, 200);
      assert.equal(trasEliminar.cuerpo.total, 2);
      assert.deepEqual(trasEliminar.cuerpo.notificaciones, [
        { ...esperadas[0], id_incidencia: null },
        esperadas[1],
      ]);

      // Retirar el acceso oculta el historial de ese proyecto.
      await database.query(
        `
          DELETE FROM obra.usuario_proyecto
          WHERE id_usuario = $1 AND id_proyecto = $2
        `,
        [colaborador, proyecto],
      );

      const sinAcceso = await consultar(cookieColaborador);

      assert.equal(sinAcceso.status, 200);
      assert.equal(sinAcceso.cuerpo.total, 0);
      assert.deepEqual(sinAcceso.cuerpo.notificaciones, []);

      // Se ocultan por permisos, pero no se borran de PostgreSQL.
      const conservadas = await database.query(
        `
          SELECT COUNT(*)::text AS total
          FROM obra.notificaciones
          WHERE id_receptor = $1
        `,
        [colaborador],
      );

      assert.equal(conservadas.rows[0].total, '2');
    } finally {
      await database.withTransaction(async (client) => {
        await client.query(
          'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
          [proyecto],
        );

        await client.query(
          'DELETE FROM obra.usuarios WHERE id_usuario = ANY($1::uuid[])',
          [[propietario, colaborador]],
        );
      });
    }
  });
});