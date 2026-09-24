require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  IncidenciasRepository,
} = require('../../dist/modules/incidencias/incidencias.repository');

/**
 * Verifica el esquema nuevo directamente en PostgreSQL.
 * No necesita archivos físicos ni utiliza las futuras rutas de mapa.
 */
test('incidencias: valida los contextos de ubicación y conserva las de mapa al eliminar el plano', async () => {
  const database = new DatabaseService();
  const finalizar = new Error('Reversión deliberada');

  await database.onModuleInit();

  try {
    await assert.rejects(
      database.withTransaction(async (client) => {
        const usuario = randomUUID();
        const proyecto = randomUUID();
        const plano = randomUUID();

        await client.query(
          `
            INSERT INTO obra.usuarios (id_usuario, correo, google_sub)
            VALUES ($1, $2, $3)
          `,
          [usuario, `${usuario}@example.invalid`, `geo-${usuario}`],
        );

        await client.query(
          `
            INSERT INTO obra.proyectos (
              id_proyecto, id_propietario, nombre, descripcion,
              direccion, contratante, fecha_inicio, estado_proyecto
            )
            VALUES (
              $1, $2, 'Proyecto geográfico', 'Prueba de ubicaciones',
              'Dirección de prueba', 'Contratante de prueba',
              '2026-09-22', 'ACTIVA'
            )
          `,
          [proyecto, usuario],
        );

        await client.query(
          `
            INSERT INTO obra.planos (
              id_plano, id_proyecto, id_usuario_subida,
              titulo, descripcion, url, s3_key, numero_paginas
            )
            VALUES ($1, $2, $3, 'Plano', '', '/prueba.pdf', $4, 2)
          `,
          [plano, proyecto, usuario, `planos/${randomUUID()}.pdf`],
        );

        async function crear(datos = {}) {
          const valores = {
            proyecto,
            plano: null,
            pagina: null,
            x: null,
            y: null,
            latitud: null,
            longitud: null,
            ...datos,
          };

          const resultado = await client.query(
            `
              INSERT INTO obra.incidencias (
                id_proyecto, id_plano, id_creador,
                titulo, descripcion, estado, prioridad,
                numero_pagina, coordenada_x, coordenada_y,
                latitud, longitud
              )
              VALUES (
                $1, $2, $3, 'Incidencia', 'Prueba',
                'PENDIENTE', 'MEDIA', $4, $5, $6, $7, $8
              )
              RETURNING id_incidencia
            `,
            [
              valores.proyecto,
              valores.plano,
              usuario,
              valores.pagina,
              valores.x,
              valores.y,
              valores.latitud,
              valores.longitud,
            ],
          );

          return resultado.rows[0].id_incidencia;
        }

        /**
         * Una sentencia SQL rechazada aborta la transacción.
         * El savepoint permite comprobar el error y continuar la prueba.
         * También revierte una inserción aceptada inesperadamente.
         */
        async function debeRechazar(datos, codigo = '23514') {
          await client.query('SAVEPOINT caso_invalido');
          let fallo;

          try {
            await crear(datos);
          } catch (error) {
            fallo = error;
          } finally {
            await client.query('ROLLBACK TO SAVEPOINT caso_invalido');
            await client.query('RELEASE SAVEPOINT caso_invalido');
          }

          assert.ok(fallo, 'PostgreSQL debía rechazar esta ubicación');
          assert.equal(fallo.code, codigo);
        }

        const contextoPlano = {
          plano,
          pagina: 1,
          x: 120.5,
          y: 80.25,
        };

        // Plano sin georreferenciación: válido.
        const soloPlano = await crear(contextoPlano);

        // Una incidencia de plano no puede tener ubicación geográfica.
        await debeRechazar({
          ...contextoPlano,
          latitud: 4.65,
          longitud: -74.1,
        });

        // Mapa sin referencia a un plano: válido.
        const soloMapa = await crear({
          latitud: 4.66,
          longitud: -74.11,
        });

        // El cero es una coordenada válida, no una ubicación ausente.
        await crear({ latitud: 0, longitud: 0 });

        for (const datos of [
          {},                                           // Sin contexto.
          { latitud: 4.65 },                             // Par incompleto.
          { longitud: -74.1 },
          { latitud: 91, longitud: 0 },
          { latitud: 0, longitud: -181 },
          { latitud: 'NaN', longitud: 0 },
          { latitud: 0, longitud: 'Infinity' },
          { latitud: 4.65, longitud: -74.1, x: 10 },       // X sin plano.
          { latitud: 4.65, longitud: -74.1, pagina: 1 },   // Página sin plano.
          { ...contextoPlano, x: null },
          { ...contextoPlano, y: null },
          { ...contextoPlano, pagina: null },
          { ...contextoPlano, pagina: 0 },
          { ...contextoPlano, x: 'NaN' },
          { ...contextoPlano, latitud: 4.65 },            // Par incompleto.
        ]) {
          await debeRechazar(datos);
        }

        // Una incidencia de mapa también necesita un proyecto existente.
        await debeRechazar(
          {
            proyecto: randomUUID(),
            latitud: 4.65,
            longitud: -74.1,
          },
          '23503',
        );

        const repositorio = new IncidenciasRepository();

        // Una incidencia de mapa no puede eliminarse indicando otro proyecto.
        assert.equal(
          await repositorio.eliminarPropiaEnMapa(
            client,
            randomUUID(),
            soloMapa,
            usuario,
          ),
          false,
        );

        // La autoría se comprueba dentro del DELETE, no solo en el servicio.
        assert.equal(
          await repositorio.eliminarPropiaEnMapa(
            client,
            proyecto,
            soloMapa,
            randomUUID(),
          ),
          false,
        );

        // Las incidencias de plano quedan fuera de esta operación.
        assert.equal(
          await repositorio.eliminarPropiaEnMapa(
            client,
            proyecto,
            soloPlano,
            usuario,
          ),
          false,
        );

        // Ninguno de los intentos anteriores debe haber eliminado registros.
        const conservadas = await client.query(
          `
    SELECT id_incidencia
    FROM obra.incidencias
    WHERE id_incidencia = ANY($1::uuid[])
    ORDER BY id_incidencia
  `,
          [[soloPlano, soloMapa]],
        );

        assert.deepEqual(
          conservadas.rows.map((fila) => fila.id_incidencia),
          [soloPlano, soloMapa].sort(),
        );

        await client.query(
          'DELETE FROM obra.planos WHERE id_plano = $1',
          [plano],
        );

        const restantes = await client.query(
          `
            SELECT id_incidencia
            FROM obra.incidencias
            WHERE id_incidencia = ANY($1::uuid[])
          `,
          [[soloPlano, soloMapa]],
        );

        // Se aplica la decisión final: ambas incidencias del plano
        // desaparecen, incluso la que también tenía latitud/longitud.
        assert.deepEqual(restantes.rows, [
          { id_incidencia: soloMapa },
        ]);

        // La relación directa con el proyecto también aplica cascada.
        await client.query(
          'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
          [proyecto],
        );

        const trasEliminarProyecto = await client.query(
          'SELECT id_incidencia FROM obra.incidencias WHERE id_proyecto = $1',
          [proyecto],
        );

        assert.equal(trasEliminarProyecto.rowCount, 0);

        throw finalizar;
      }),
      (error) => error === finalizar,
    );
  } finally {
    await database.onApplicationShutdown();
  }
});