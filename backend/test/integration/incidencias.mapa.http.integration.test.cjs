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

const {
  ActividadesRepository,
} = require('../../dist/modules/actividades/actividades.repository');

/**
 * Usa autenticación, servicios, repositorios y trigger reales.
 *
 * No crea planos ni archivos. El ayudante mantiene deshabilitado
 * el trabajador de correo y el finally elimina los datos de prueba.
 */
test('incidencias de mapa HTTP: crea, lista y elimina respetando permisos', async (t) => {
  await conAplicacionReal(async ({ app, baseUrl, origen }) => {
    const database = app.get(DatabaseService);
    const passwords = app.get(PasswordService);

    const propietario = randomUUID();
    const creador = randomUUID();
    const colaborador = randomUUID();
    const ajeno = randomUUID();
    const proyecto = randomUUID();
    const usuarios = [propietario, creador, colaborador, ajeno];

    const password = 'Clave temporal de integración-2026';
    const hash = await passwords.generarHash(password);

    try {
      await database.withTransaction(async (client) => {
        for (const usuario of usuarios) {
          await client.query(
            `
              INSERT INTO obra.usuarios (
                id_usuario, correo, password_hash
              )
              VALUES ($1, $2, $3)
            `,
            [usuario, `${usuario}@example.invalid`, hash],
          );
        }

        await client.query(
          `
            INSERT INTO obra.proyectos (
              id_proyecto, id_propietario, nombre, descripcion,
              direccion, contratante, fecha_inicio, estado_proyecto
            )
            VALUES (
              $1, $2, 'Proyecto mapa HTTP', 'Prueba de creación',
              'Dirección temporal', 'Contratante temporal',
              '2026-09-22', 'ACTIVA'
            )
          `,
          [proyecto, propietario],
        );

        for (const usuario of [creador, colaborador]) {
          await client.query(
            `
              INSERT INTO obra.usuario_proyecto (
                id_usuario, id_proyecto
              )
              VALUES ($1, $2)
            `,
            [usuario, proyecto],
          );
        }
      });

      async function iniciarSesion(usuario) {
        const respuesta = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            Origin: origen,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            correo: `${usuario}@example.invalid`,
            password,
          }),
        });

        await respuesta.json();
        assert.equal(respuesta.status, 200);

        const cookie = respuesta.headers.getSetCookie().find(
          (valor) => valor.startsWith(`${AUTH_COOKIE_NAME}=`),
        );

        assert.ok(cookie);
        return cookie.split(';')[0];
      }

      const cookieCreador = await iniciarSesion(creador);
      const cookieAjeno = await iniciarSesion(ajeno);

      const cookiePropietario = await iniciarSesion(propietario);
      const cookieColaborador = await iniciarSesion(colaborador);

      const datos = {
        titulo: 'Fisura en el acceso',
        descripcion: 'Revisar el punto del mapa.',
        prioridad: 'ALTA',
        latitud: 4.711,
        longitud: -74.0721,
      };

      async function crear(cookie, cambios = {}, idProyecto = proyecto) {
        const respuesta = await fetch(
          `${baseUrl}/api/proyectos/${idProyecto}/incidencias/mapa`,
          {
            method: 'POST',
            headers: {
              Origin: origen,
              'Content-Type': 'application/json',
              ...(cookie ? { Cookie: cookie } : {}),
            },
            body: JSON.stringify({ ...datos, ...cambios }),
          },
        );

        return {
          status: respuesta.status,
          cache: respuesta.headers.get('cache-control'),
          cuerpo: await respuesta.json(),
        };
      }

      /**
 * Consulta por HTTP utilizando sesión real.
 * Los parámetros se envían como texto, tal como lo hará el frontend.
 */
      async function listar(
        cookie,
        consulta = '',
        idProyecto = proyecto,
      ) {
        const respuesta = await fetch(
          `${baseUrl}/api/proyectos/${idProyecto}/incidencias/mapa${consulta}`,
          {
            headers: cookie ? { Cookie: cookie } : {},
          },
        );

        return {
          status: respuesta.status,
          cache: respuesta.headers.get('cache-control'),
          cuerpo: await respuesta.json(),
        };
      }

      // Autenticación y autorización se aplican también a la consulta.
      assert.equal((await listar()).status, 401);
      assert.equal((await listar(cookieAjeno)).status, 404);

      assert.equal(
        (await listar(cookieCreador, '', randomUUID())).status,
        404,
      );

      // Un proyecto accesible sin incidencias devuelve una página vacía.
      const vacio = await listar(cookieCreador);

      assert.equal(vacio.status, 200);
      assert.equal(vacio.cache, 'no-store');
      assert.deepEqual(vacio.cuerpo, {
        incidencias: [],
        pagina: 1,
        limite: 50,
        total: 0,
        total_paginas: 0,
      });

      const creada = await crear(cookieCreador);

      assert.equal(creada.status, 201);
      assert.equal(creada.cache, 'no-store');

      const incidencia = creada.cuerpo;

      assert.match(
        incidencia.id_incidencia,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      assert.ok(Number.isFinite(Date.parse(incidencia.fecha_creacion)));

      assert.deepEqual(incidencia, {
        id_incidencia: incidencia.id_incidencia,
        id_proyecto: proyecto,
        id_creador: creador,
        ...datos,
        estado: 'PENDIENTE',
        id_plano: null,
        numero_pagina: null,
        coordenada_x: null,
        coordenada_y: null,
        fecha_creacion: incidencia.fecha_creacion,
      });

      const guardadas = await database.query(
        'SELECT * FROM obra.incidencias WHERE id_proyecto = $1',
        [proyecto],
      );

      assert.equal(guardadas.rowCount, 1);
      const registro = guardadas.rows[0];

      assert.equal(registro.id_incidencia, incidencia.id_incidencia);
      assert.equal(registro.id_creador, creador);
      assert.equal(registro.id_plano, null);
      assert.equal(registro.numero_pagina, null);
      assert.equal(registro.coordenada_x, null);
      assert.equal(registro.coordenada_y, null);
      assert.equal(typeof registro.latitud, 'string');
      assert.equal(typeof registro.longitud, 'string');
      assert.equal(Number(registro.latitud), datos.latitud);
      assert.equal(Number(registro.longitud), datos.longitud);

      async function consultarActividad() {
        return database.query(
          `
            SELECT id_actor, tipo_accion, mensaje
            FROM obra.actividades
            WHERE id_proyecto = $1
            ORDER BY id_actividad
          `,
          [proyecto],
        );
      }

      const actividades = await consultarActividad();

      assert.deepEqual(actividades.rows, [{
        id_actor: creador,
        tipo_accion: 'INCIDENCIA_CREADA',
        mensaje:
          `Incidencia ${incidencia.id_incidencia} creada en el mapa.`,
      }]);

      async function consultarNotificaciones() {
        return database.query(
          `
            SELECT
              id_receptor, id_actor, id_incidencia,
              tipo, estado_envio_correo
            FROM obra.notificaciones
            WHERE id_proyecto = $1
            ORDER BY id_receptor
          `,
          [proyecto],
        );
      }

      const notificaciones = await consultarNotificaciones();

      assert.deepEqual(
        notificaciones.rows,
        [propietario, colaborador].sort().map((receptor) => ({
          id_receptor: receptor,
          id_actor: creador,
          id_incidencia: incidencia.id_incidencia,
          tipo: 'INCIDENCIA_CREADA',
          estado_envio_correo: 'PENDIENTE',
        })),
      );

      // Propietario, creador y otro colaborador pueden consultar la incidencia.
      const listadoEsperado = {
        incidencias: [incidencia],
        pagina: 1,
        limite: 50,
        total: 1,
        total_paginas: 1,
      };

      for (const cookie of [
        cookiePropietario,
        cookieCreador,
        cookieColaborador,
      ]) {
        const listado = await listar(cookie);

        assert.equal(listado.status, 200);
        assert.equal(listado.cache, 'no-store');
        assert.deepEqual(listado.cuerpo, listadoEsperado);
      }

      // Comprueba la conversión de parámetros de URL.
      const primeraPagina = await listar(
        cookieCreador,
        '?pagina=1&limite=1',
      );

      assert.equal(primeraPagina.status, 200);
      assert.deepEqual(primeraPagina.cuerpo, {
        incidencias: [incidencia],
        pagina: 1,
        limite: 1,
        total: 1,
        total_paginas: 1,
      });

      // Una página fuera de los resultados conserva el total.
      const paginaVacia = await listar(
        cookieCreador,
        '?pagina=2&limite=1',
      );

      assert.equal(paginaVacia.status, 200);
      assert.deepEqual(paginaVacia.cuerpo, {
        incidencias: [],
        pagina: 2,
        limite: 1,
        total: 1,
        total_paginas: 1,
      });

      // La ruta no admite parámetros de plano ni paginación inválida.
      for (const consulta of [
        '?pagina=0',
        '?pagina=1.5',
        '?pagina=2147483648',
        '?limite=0',
        '?limite=101',
        '?limite=',
        '?numero_pagina=1',
        '?id_plano=plano',
        '?extra=1',
      ]) {
        assert.equal(
          (await listar(cookieCreador, consulta)).status,
          400,
        );
      }

      // Un UUID mal formado debe rechazarse antes de consultar el proyecto.
      assert.equal(
        (await listar(cookieCreador, '', 'incorrecto')).status,
        400,
      );

      // Ninguno de estos cuerpos debe llegar a la inserción.

      // Ninguno de estos cuerpos debe llegar a la inserción.
      for (const cambios of [
        { latitud: undefined },
        { longitud: null },
        { latitud: '4.711' },
        { longitud: 181 },
        { id_plano: null },
        { numero_pagina: 1 },
        { coordenada_x: 0 },
        { id_creador: propietario },
        { estado: 'SOLUCIONADA' },
      ]) {
        assert.equal(
          (await crear(cookieCreador, cambios)).status,
          400,
        );
      }

      // Una sesión válida no conserva permisos de colaboración retirados.
      await database.query(
        `
          DELETE FROM obra.usuario_proyecto
          WHERE id_usuario = $1 AND id_proyecto = $2
        `,
        [creador, proyecto],
      );

      assert.equal((await crear(cookieCreador)).status, 404);

      // La misma cookie pierde también el acceso de lectura.
      const listadoSinAcceso = await listar(cookieCreador);

      assert.equal(listadoSinAcceso.status, 404);
      assert.equal(
        listadoSinAcceso.cuerpo.message,
        'El proyecto no está disponible.',
      );

      // Los demás miembros conservan acceso y la incidencia sigue existiendo.
      assert.deepEqual(
        (await listar(cookiePropietario)).cuerpo,
        listadoEsperado,
      );
      assert.deepEqual(
        (await listar(cookieColaborador)).cuerpo,
        listadoEsperado,
      );

      const posteriores = await database.query(
        'SELECT * FROM obra.incidencias WHERE id_proyecto = $1',
        [proyecto],
      );

      assert.deepEqual(posteriores.rows, guardadas.rows);
      assert.deepEqual(
        (await consultarActividad()).rows,
        actividades.rows,
      );
      assert.deepEqual(
        (await consultarNotificaciones()).rows,
        notificaciones.rows,
      );

      async function eliminar(
        cookie,
        idIncidencia = incidencia.id_incidencia,
      ) {
        const respuesta = await fetch(
          `${baseUrl}/api/proyectos/${proyecto}/incidencias/mapa/${idIncidencia}`,
          {
            method: 'DELETE',
            headers: {
              Origin: origen,
              ...(cookie ? { Cookie: cookie } : {}),
            },
          },
        );

        // DELETE exitoso devuelve 204 sin cuerpo.
        return {
          status: respuesta.status,
          cache: respuesta.headers.get('cache-control'),
          texto: await respuesta.text(),
        };
      }

      assert.equal((await eliminar()).status, 401);
      assert.equal((await eliminar(cookieAjeno)).status, 404);

      // El creador tampoco puede borrar mientras no tenga acceso al proyecto.
      assert.equal((await eliminar(cookieCreador)).status, 404);

      // Restablecemos su colaboración para las siguientes comprobaciones.
      await database.query(
        `
    INSERT INTO obra.usuario_proyecto (id_usuario, id_proyecto)
    VALUES ($1, $2)
  `,
        [creador, proyecto],
      );

      // Tener acceso, incluso como propietario, no sustituye la autoría.
      for (const cookie of [cookiePropietario, cookieColaborador]) {
        const rechazo = await eliminar(cookie);

        assert.equal(rechazo.status, 404);
        assert.equal(
          JSON.parse(rechazo.texto).message,
          'La incidencia no está disponible.',
        );
      }

      assert.equal(
        (await eliminar(cookieCreador, 'incorrecto')).status,
        400,
      );
      assert.equal(
        (await eliminar(cookieCreador, randomUUID())).status,
        404,
      );

      async function consultarRegistroCompleto() {
        return (await database.query(
          'SELECT * FROM obra.incidencias WHERE id_incidencia = $1',
          [incidencia.id_incidencia],
        )).rows;
      }

      async function consultarNotificacionesCompletas() {
        return (await database.query(
          `
      SELECT *
      FROM obra.notificaciones
      WHERE id_incidencia = $1
      ORDER BY id_receptor
    `,
          [incidencia.id_incidencia],
        )).rows;
      }

      // Ningún rechazo anterior debe haber alterado los datos.
      assert.deepEqual(await consultarRegistroCompleto(), guardadas.rows);
      assert.deepEqual(
        (await consultarActividad()).rows,
        actividades.rows,
      );
      assert.deepEqual(
        (await consultarNotificaciones()).rows,
        notificaciones.rows,
      );

      const notificacionesAntesDelFallo =
        await consultarNotificacionesCompletas();

      const repositorioActividades = app.get(ActividadesRepository);
      let eliminacionObservada = false;

      /*
       * Provocamos un fallo del historial después del DELETE.
       * La conexión, el DELETE y el ROLLBACK son reales.
       */
      const sustituida = t.mock.method(
        repositorioActividades,
        'crear',
        async (client, datosActividad) => {
          assert.equal(datosActividad.tipoAccion, 'INCIDENCIA_ELIMINADA');
          assert.equal(datosActividad.idActor, creador);

          const dentro = await client.query(
            'SELECT id_incidencia FROM obra.incidencias WHERE id_incidencia = $1',
            [incidencia.id_incidencia],
          );

          assert.equal(dentro.rowCount, 0);
          eliminacionObservada = true;

          // Error SQL deliberado: mensaje no permite NULL.
          await client.query(
            `
        INSERT INTO obra.actividades (
          id_proyecto, id_actor, tipo_accion, mensaje
        )
        VALUES ($1, $2, $3, NULL)
      `,
            [proyecto, creador, datosActividad.tipoAccion],
          );
        },
      );

      try {
        const fallida = await eliminar(cookieCreador);
        assert.equal(fallida.status, 500);
      } finally {
        sustituida.mock.restore();
      }

      assert.equal(eliminacionObservada, true);

      // Fuera de la transacción: la incidencia y sus notificaciones se conservan.
      assert.deepEqual(await consultarRegistroCompleto(), guardadas.rows);
      assert.deepEqual(
        await consultarNotificacionesCompletas(),
        notificacionesAntesDelFallo,
      );
      assert.deepEqual(
        (await consultarActividad()).rows,
        actividades.rows,
      );

      // Con el historial operativo, el creador sí puede eliminarla.
      const eliminada = await eliminar(cookieCreador);

      assert.equal(eliminada.status, 204);
      assert.equal(eliminada.cache, 'no-store');
      assert.equal(eliminada.texto, '');
      assert.deepEqual(await consultarRegistroCompleto(), []);

      const listadoFinal = await listar(cookiePropietario);

      assert.equal(listadoFinal.status, 200);
      assert.deepEqual(listadoFinal.cuerpo, {
        incidencias: [],
        pagina: 1,
        limite: 50,
        total: 0,
        total_paginas: 0,
      });

      // El borrado de la incidencia no elimina su proyecto.
      const proyectoConservado = await database.query(
        'SELECT id_proyecto FROM obra.proyectos WHERE id_proyecto = $1',
        [proyecto],
      );
      assert.deepEqual(proyectoConservado.rows, [{ id_proyecto: proyecto }]);

      const historialFinal = (await consultarActividad()).rows;
      const borrados = historialFinal.filter(
        (fila) => fila.tipo_accion === 'INCIDENCIA_ELIMINADA',
      );

      assert.deepEqual(borrados, [{
        id_actor: creador,
        tipo_accion: 'INCIDENCIA_ELIMINADA',
        mensaje: `Incidencia ${incidencia.id_incidencia} eliminada.`,
      }]);

      // Repetir la eliminación no crea una segunda actividad.
      assert.equal((await eliminar(cookieCreador)).status, 404);
      assert.deepEqual(
        (await consultarActividad()).rows,
        historialFinal,
      );
    } finally {
      // La cascada del proyecto limpia sus incidencias y notificaciones.
      await database.withTransaction(async (client) => {
        await client.query(
          'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
          [proyecto],
        );

        await client.query(
          'DELETE FROM obra.usuarios WHERE id_usuario = ANY($1::uuid[])',
          [usuarios],
        );
      });
    }
  });
});