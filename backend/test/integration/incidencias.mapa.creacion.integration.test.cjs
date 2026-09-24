require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  IncidenciasRepository,
} = require('../../dist/modules/incidencias/incidencias.repository');

/**
 * Comprueba la creación de incidencias sin plano y las notificaciones
 * producidas por el trigger existente.
 *
 * Los registros permanecen dentro de una transacción que se revierte.
 * No se confirma ninguna notificación para el trabajador de correo.
 */
test('incidencias de mapa: persiste la ubicación y notifica a los demás miembros activos', async () => {
  const database = new DatabaseService();
  const repositorio = new IncidenciasRepository();
  const finalizar = new Error('Reversión deliberada de la prueba');

  await database.onModuleInit();

  try {
    await assert.rejects(
      database.withTransaction(async (client) => {
        const propietario = randomUUID();
        const creador = randomUUID();
        const colaborador = randomUUID();
        const inactivo = randomUUID();
        const ajeno = randomUUID();
        const proyecto = randomUUID();

        for (const usuario of [
          propietario,
          creador,
          colaborador,
          inactivo,
          ajeno,
        ]) {
          await client.query(
            `
              INSERT INTO obra.usuarios (
                id_usuario, correo, google_sub, estado
              )
              VALUES ($1, $2, $3, $4)
            `,
            [
              usuario,
              `${usuario}@example.invalid`,
              `mapa-${usuario}`,
              usuario === inactivo ? 'INACTIVO' : 'ACTIVO',
            ],
          );
        }

        await client.query(
          `
            INSERT INTO obra.proyectos (
              id_proyecto, id_propietario, nombre, descripcion,
              direccion, contratante, fecha_inicio, estado_proyecto
            )
            VALUES (
              $1, $2, 'Proyecto de mapa', 'Prueba de incidencias',
              'Dirección temporal', 'Contratante temporal',
              '2026-09-22', 'ACTIVA'
            )
          `,
          [proyecto, propietario],
        );

        /*
         * El propietario también figura como colaborador:
         * debe recibir una sola notificación.
         *
         * El usuario ajeno no tiene relación con el proyecto.
         */
        for (const usuario of [
          propietario,
          creador,
          colaborador,
          inactivo,
        ]) {
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

        async function crearYComprobar(
          actor,
          destinatarios,
          latitud,
          longitud,
        ) {
          const incidencia = await repositorio.crearEnMapa(client, {
            id_proyecto: proyecto,
            id_creador: actor,
            titulo: 'Incidencia ubicada en el mapa',
            descripcion: 'Revisar el punto seleccionado.',
            prioridad: 'ALTA',
            latitud,
            longitud,
          });

          assert.equal(incidencia.id_proyecto, proyecto);
          assert.equal(incidencia.id_creador, actor);
          assert.equal(incidencia.estado, 'PENDIENTE');
          assert.equal(incidencia.prioridad, 'ALTA');

          assert.equal(incidencia.id_plano, null);
          assert.equal(incidencia.numero_pagina, null);
          assert.equal(incidencia.coordenada_x, null);
          assert.equal(incidencia.coordenada_y, null);

          assert.equal(typeof incidencia.latitud, 'string');
          assert.equal(typeof incidencia.longitud, 'string');
          assert.equal(Number(incidencia.latitud), latitud);
          assert.equal(Number(incidencia.longitud), longitud);
          assert.ok(incidencia.fecha_creacion instanceof Date);

          // Contrastamos el RETURNING con el registro almacenado.
          const persistida = await client.query(
            `
              SELECT
                id_incidencia, id_proyecto, id_plano, id_creador,
                titulo, descripcion, estado, prioridad,
                numero_pagina, coordenada_x, coordenada_y,
                latitud, longitud, fecha_creacion
              FROM obra.incidencias
              WHERE id_incidencia = $1
            `,
            [incidencia.id_incidencia],
          );

          assert.equal(persistida.rowCount, 1);
          assert.deepEqual(persistida.rows[0], incidencia);

          /*
           * El INSERT ya ejecutó el trigger.
           * No llamamos al repositorio de notificaciones.
           */
          const notificaciones = await client.query(
            `
              SELECT
                id_receptor,
                id_actor,
                id_proyecto,
                id_incidencia,
                tipo,
                titulo,
                mensaje,
                estado_envio_correo
              FROM obra.notificaciones
              WHERE id_incidencia = $1
              ORDER BY id_receptor
            `,
            [incidencia.id_incidencia],
          );

          assert.deepEqual(
            notificaciones.rows,
            [...destinatarios].sort().map((receptor) => ({
              id_receptor: receptor,
              id_actor: actor,
              id_proyecto: proyecto,
              id_incidencia: incidencia.id_incidencia,
              tipo: 'INCIDENCIA_CREADA',
              titulo: 'Incidencia creada',
              mensaje: 'Incidencia ubicada en el mapa',
              estado_envio_correo: 'PENDIENTE',
            })),
          );
        }

        // Crea un colaborador: reciben propietario y otro colaborador.
        await crearYComprobar(
          creador,
          [propietario, colaborador],
          4.711,
          -74.0721,
        );

        // Crea el propietario: reciben los colaboradores activos.
        // También comprobamos que cero no se convierta en NULL.
        await crearYComprobar(
          propietario,
          [creador, colaborador],
          0,
          0,
        );

        // Sin otros miembros activos, la creación sigue siendo válida.
        await client.query(
          `
            DELETE FROM obra.usuario_proyecto
            WHERE id_proyecto = $1
              AND id_usuario = ANY($2::uuid[])
          `,
          [proyecto, [creador, colaborador]],
        );

        await crearYComprobar(propietario, [], 4.711, -74.0721);

        throw finalizar;
      }),
      (error) => error === finalizar,
    );
  } finally {
    await database.onApplicationShutdown();
  }
});