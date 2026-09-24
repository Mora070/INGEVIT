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
  ActividadesRepository,
} = require('../../dist/modules/actividades/actividades.repository');

const {
  IncidenciasMapaCreacionService,
} = require('../../dist/modules/incidencias/incidencias-mapa-creacion.service');

const {
  IncidenciasMapaEdicionService,
} = require('../../dist/modules/incidencias/incidencias-mapa-edicion.service');

/**
 * Ejecuta servicios y transacciones reales.
 *
 * Solo sustituye temporalmente la escritura del historial para
 * provocar un error SQL y comprobar el ROLLBACK.
 */
test('edición de mapa: conserva contexto, comprueba acceso y revierte ante fallos', async (t) => {
  await conAplicacionReal(async ({ app }) => {
    const database = app.get(DatabaseService);
    const creacion = app.get(IncidenciasMapaCreacionService);
    const edicion = app.get(IncidenciasMapaEdicionService);
    const actividades = app.get(ActividadesRepository);

    const propietario = randomUUID();
    const editor = randomUUID();
    const ajeno = randomUUID();
    const proyecto = randomUUID();
    const otroProyecto = randomUUID();
    const plano = randomUUID();
    const incidenciaPlano = randomUUID();
    const usuarios = [propietario, editor, ajeno];

    try {
      await database.withTransaction(async (client) => {
        for (const usuario of usuarios) {
          await client.query(
            `
              INSERT INTO obra.usuarios (
                id_usuario, correo, google_sub
              )
              VALUES ($1, $2, $3)
            `,
            [
              usuario,
              `${usuario}@example.invalid`,
              `edicion-mapa-${usuario}`,
            ],
          );
        }

        for (const id of [proyecto, otroProyecto]) {
          await client.query(
            `
              INSERT INTO obra.proyectos (
                id_proyecto, id_propietario, nombre, descripcion,
                direccion, contratante, fecha_inicio, estado_proyecto
              )
              VALUES (
                $1, $2, 'Proyecto temporal', 'Edición de mapa',
                'Dirección temporal', 'Contratante temporal',
                '2026-09-22', 'ACTIVA'
              )
            `,
            [id, propietario],
          );
        }

        await client.query(
          `
            INSERT INTO obra.usuario_proyecto (id_usuario, id_proyecto)
            VALUES ($1, $2)
          `,
          [editor, proyecto],
        );

        await client.query(
          `
            INSERT INTO obra.planos (
              id_plano, id_proyecto, id_usuario_subida,
              titulo, descripcion, url, s3_key, numero_paginas
            )
            VALUES ($1, $2, $3, 'Plano', '', '/prueba.pdf', $4, 1)
          `,
          [plano, proyecto, propietario, `planos/${randomUUID()}.pdf`],
        );

        await client.query(
          `
            INSERT INTO obra.incidencias (
              id_incidencia, id_proyecto, id_plano, id_creador,
              titulo, descripcion, estado, prioridad,
              numero_pagina, coordenada_x, coordenada_y
            )
            VALUES (
              $1, $2, $3, $4, 'Incidencia de plano', 'Conservar',
              'PENDIENTE', 'MEDIA', 1, 120, 80
            )
          `,
          [incidenciaPlano, proyecto, plano, propietario],
        );
      });

      const creada = await creacion.crear(proyecto, propietario, {
        titulo: 'Incidencia original',
        descripcion: 'Descripción original.',
        prioridad: 'MEDIA',
        latitud: 4.711,
        longitud: -74.0721,
      });

      async function consultarIncidencia(id = creada.id_incidencia) {
        const resultado = await database.query(
          'SELECT * FROM obra.incidencias WHERE id_incidencia = $1',
          [id],
        );
        assert.equal(resultado.rowCount, 1);
        return resultado.rows[0];
      }

      async function consultarHistorial() {
        return (await database.query(
          `
            SELECT *
            FROM obra.actividades
            WHERE id_proyecto = $1
            ORDER BY id_actividad
          `,
          [proyecto],
        )).rows;
      }

      async function consultarNotificaciones() {
        return (await database.query(
          `
            SELECT *
            FROM obra.notificaciones
            WHERE id_incidencia = $1
            ORDER BY id_receptor
          `,
          [creada.id_incidencia],
        )).rows;
      }

      const original = await consultarIncidencia();
      const planoOriginal = await consultarIncidencia(incidenciaPlano);

      const cambios = {
        titulo: 'Incidencia revisada',
        descripcion: 'Reparación verificada.',
        prioridad: 'BAJA',
        estado: 'SOLUCIONADA',
      };

      // Un colaborador puede editar sin convertirse en el creador.
      const respuesta = await edicion.actualizarDatos(
        proyecto,
        creada.id_incidencia,
        editor,
        cambios,
      );

      assert.deepEqual(respuesta, { ...creada, ...cambios });
      assert.deepEqual(
        await consultarIncidencia(),
        { ...original, ...cambios },
      );

      const historial = await consultarHistorial();
      const guardados = historial.filter(
        (fila) => fila.tipo_accion === 'INCIDENCIA_DATOS_GUARDADOS',
      );

      assert.equal(guardados.length, 1);
      assert.equal(guardados[0].id_actor, editor);
      assert.equal(
        guardados[0].mensaje,
        `Datos de la incidencia ${creada.id_incidencia} guardados.`,
      );

      // Los rechazos no deben modificar ninguna de las dos incidencias.
      for (const [idProyecto, idIncidencia, usuario] of [
        [proyecto, creada.id_incidencia, ajeno],
        [otroProyecto, creada.id_incidencia, propietario],
        [proyecto, incidenciaPlano, editor],
        [proyecto, randomUUID(), editor],
      ]) {
        await assert.rejects(
          edicion.actualizarDatos(
            idProyecto,
            idIncidencia,
            usuario,
            cambios,
          ),
          (error) => error.getStatus() === 404,
        );
      }

      assert.deepEqual(await consultarIncidencia(incidenciaPlano), planoOriginal);
      assert.deepEqual(await consultarHistorial(), historial);

      const antesDelFallo = await consultarIncidencia();
      const notificacionesAntes = await consultarNotificaciones();
      let cambioObservado = false;

      const sustituida = t.mock.method(
        actividades,
        'crear',
        async (client, datos) => {
          assert.equal(datos.tipoAccion, 'INCIDENCIA_DATOS_GUARDADOS');
          assert.equal(datos.idActor, editor);

          // Dentro de la transacción, el UPDATE ya debe ser visible.
          const pendiente = await client.query(
            'SELECT titulo FROM obra.incidencias WHERE id_incidencia = $1',
            [creada.id_incidencia],
          );

          assert.equal(
            pendiente.rows[0].titulo,
            'Cambio que debe revertirse',
          );
          cambioObservado = true;

          // Error SQL real: mensaje no permite NULL.
          await client.query(
            `
              INSERT INTO obra.actividades (
                id_proyecto, id_actor, tipo_accion, mensaje
              )
              VALUES ($1, $2, $3, NULL)
            `,
            [proyecto, editor, datos.tipoAccion],
          );
        },
      );

      try {
        await assert.rejects(
          edicion.actualizarDatos(
            proyecto,
            creada.id_incidencia,
            editor,
            { ...cambios, titulo: 'Cambio que debe revertirse' },
          ),
          (error) => error.code === '23502',
        );
      } finally {
        sustituida.mock.restore();
      }

      assert.equal(cambioObservado, true);

      // Consultas fuera de la transacción fallida: verifican la reversión.
      assert.deepEqual(await consultarIncidencia(), antesDelFallo);
      assert.deepEqual(await consultarHistorial(), historial);
      assert.deepEqual(
        await consultarNotificaciones(),
        notificacionesAntes,
      );

      // Retirar la colaboración también revoca la edición.
      await database.query(
        `
          DELETE FROM obra.usuario_proyecto
          WHERE id_usuario = $1 AND id_proyecto = $2
        `,
        [editor, proyecto],
      );

      await assert.rejects(
        edicion.actualizarDatos(
          proyecto,
          creada.id_incidencia,
          editor,
          cambios,
        ),
        (error) => error.getStatus() === 404,
      );

      assert.deepEqual(await consultarIncidencia(), antesDelFallo);
      assert.deepEqual(await consultarHistorial(), historial);
    } finally {
      await database.withTransaction(async (client) => {
        await client.query(
          'DELETE FROM obra.proyectos WHERE id_proyecto = ANY($1::uuid[])',
          [[proyecto, otroProyecto]],
        );

        await client.query(
          'DELETE FROM obra.usuarios WHERE id_usuario = ANY($1::uuid[])',
          [usuarios],
        );
      });
    }
  });
});