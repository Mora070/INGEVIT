require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  IncidenciasMapaConsultaRepository,
} = require('../../dist/modules/incidencias/incidencias-mapa-consulta.repository');

/**
 * Ejecuta el SQL del repositorio contra PostgreSQL real.
 *
 * Las consultas usan el cliente de la transacción para ver los datos
 * temporales. Al finalizar se revierte todo, incluidas notificaciones.
 */
test('listado de incidencias de mapa: aplica permisos, contexto y paginación', async () => {
  const database = new DatabaseService();
  const finalizar = new Error('Reversión deliberada');

  await database.onModuleInit();

  try {
    await assert.rejects(
      database.withTransaction(async (client) => {
        const propietario = randomUUID();
        const colaborador = randomUUID();
        const ajeno = randomUUID();
        const proyecto = randomUUID();
        const otroProyecto = randomUUID();
        const plano = randomUUID();

        const repositorio = new IncidenciasMapaConsultaRepository({
          query: (sql, valores) => client.query(sql, valores),
        });

        for (const usuario of [propietario, colaborador, ajeno]) {
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
              `consulta-mapa-${usuario}`,
            ],
          );
        }

        for (const idProyecto of [proyecto, otroProyecto]) {
          await client.query(
            `
              INSERT INTO obra.proyectos (
                id_proyecto, id_propietario, nombre, descripcion,
                direccion, contratante, fecha_inicio, estado_proyecto
              )
              VALUES (
                $1, $2, 'Proyecto temporal', 'Consulta de mapa',
                'Dirección temporal', 'Contratante temporal',
                '2026-09-22', 'ACTIVA'
              )
            `,
            [idProyecto, propietario],
          );
        }

        await client.query(
          `
            INSERT INTO obra.usuario_proyecto (id_usuario, id_proyecto)
            VALUES ($1, $2)
          `,
          [colaborador, proyecto],
        );

        function consultar(
          usuario = propietario,
          pagina = 1,
          limite = 2,
          idProyecto = proyecto,
        ) {
          return repositorio.listarDisponibles(
            idProyecto,
            usuario,
            pagina,
            limite,
          );
        }

        // Proyecto accesible vacío y proyecto inaccesible son distintos.
        assert.deepEqual(await consultar(), {
          incidencias: [],
          total: 0,
        });
        assert.equal(await consultar(ajeno), null);
        assert.equal(
          await consultar(propietario, 1, 2, randomUUID()),
          null,
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

        async function insertar({
          id = randomUUID(),
          idProyecto = proyecto,
          idPlano = null,
          fecha = '2026-09-22T12:00:00.000Z',
        } = {}) {
          await client.query(
            `
              INSERT INTO obra.incidencias (
                id_incidencia, id_proyecto, id_plano, id_creador,
                titulo, descripcion, estado, prioridad,
                numero_pagina, coordenada_x, coordenada_y,
                latitud, longitud, fecha_creacion
              )
              VALUES (
                $1, $2, $3, $4,
                'Incidencia temporal', 'Prueba de consulta',
                'PENDIENTE', 'MEDIA',
                $5, $6, $7, $9::numeric, $10::numeric, $8
              )
            `,
            [
              id,
              idProyecto,
              idPlano,
              propietario,
              idPlano === null ? null : 1,
              idPlano === null ? null : 120,
              idPlano === null ? null : 80,
              fecha,
              idPlano === null ? 4.711 : null,
              idPlano === null ? -74.0721 : null,
            ],
          );

          return id;
        }

        // Dos registros con la misma fecha permiten comprobar el desempate.
        const empatadas = [randomUUID(), randomUUID()].sort().reverse();

        for (const id of empatadas) {
          await insertar({ id });
        }

        const antigua = await insertar({
          fecha: '2026-09-21T12:00:00.000Z',
        });

        // No deben aparecer: incidencia de plano e incidencia de otro proyecto.
        await insertar({ idPlano: plano });
        await insertar({ idProyecto: otroProyecto });

        const primera = await consultar();

        assert.equal(primera.total, 3);
        assert.deepEqual(
          primera.incidencias.map((fila) => fila.id_incidencia),
          empatadas,
        );

        for (const fila of primera.incidencias) {
          assert.equal(fila.id_proyecto, proyecto);
          assert.equal(fila.id_plano, null);
          assert.equal(fila.numero_pagina, null);
          assert.equal(fila.coordenada_x, null);
          assert.equal(fila.coordenada_y, null);
          assert.equal(typeof fila.latitud, 'string');
          assert.equal(typeof fila.longitud, 'string');
          assert.equal(Number(fila.latitud), 4.711);
          assert.equal(Number(fila.longitud), -74.0721);
          assert.ok(fila.fecha_creacion instanceof Date);
          assert.equal(Object.hasOwn(fila, 'total'), false);
        }

        // El colaborador activo puede consultar los mismos resultados.
        assert.deepEqual(await consultar(colaborador), primera);

        const segunda = await consultar(propietario, 2);

        assert.equal(segunda.total, 3);
        assert.deepEqual(
          segunda.incidencias.map((fila) => fila.id_incidencia),
          [antigua],
        );

        assert.deepEqual(await consultar(propietario, 3), {
          incidencias: [],
          total: 3,
        });

        // Un usuario inactivo pierde acceso aunque conserve la relación.
        await client.query(
          "UPDATE obra.usuarios SET estado = 'INACTIVO' WHERE id_usuario = $1",
          [colaborador],
        );
        assert.equal(await consultar(colaborador), null);

        await client.query(
          "UPDATE obra.usuarios SET estado = 'ACTIVO' WHERE id_usuario = $1",
          [colaborador],
        );
        assert.deepEqual(await consultar(colaborador), primera);

        // Si el propietario está inactivo, tampoco accede el colaborador.
        await client.query(
          "UPDATE obra.usuarios SET estado = 'INACTIVO' WHERE id_usuario = $1",
          [propietario],
        );
        assert.equal(await consultar(colaborador), null);

        await client.query(
          "UPDATE obra.usuarios SET estado = 'ACTIVO' WHERE id_usuario = $1",
          [propietario],
        );

        // Un proyecto eliminado lógicamente no está disponible.
        await client.query(
          'UPDATE obra.proyectos SET activo = FALSE WHERE id_proyecto = $1',
          [proyecto],
        );
        assert.equal(await consultar(), null);
        assert.equal(await consultar(colaborador), null);

        await client.query(
          'UPDATE obra.proyectos SET activo = TRUE WHERE id_proyecto = $1',
          [proyecto],
        );

        // Retirar la colaboración revoca el acceso inmediatamente.
        await client.query(
          `
            DELETE FROM obra.usuario_proyecto
            WHERE id_usuario = $1 AND id_proyecto = $2
          `,
          [colaborador, proyecto],
        );

        assert.equal(await consultar(colaborador), null);
        assert.deepEqual(await consultar(), primera);

        throw finalizar;
      }),
      (error) => error === finalizar,
    );
  } finally {
    await database.onApplicationShutdown();
  }
});