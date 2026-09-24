require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  FotografiasRepository,
} = require('../../dist/modules/fotografias/fotografias.repository');

const {
  FotografiasAccesoRepository,
} = require('../../dist/modules/fotografias/fotografias-acceso.repository');

const {
  FotografiasEliminacionService,
} = require('../../dist/modules/fotografias/fotografias-eliminacion.service');

const {
  ArchivosPendientesRepository,
} = require('../../dist/modules/almacenamiento/archivos-pendientes.repository');

const {
  ActividadesRepository,
} = require('../../dist/modules/actividades/actividades.repository');

test(
  'eliminación fotografía: revierte fotografía y pendientes ante fallos de cola o actividad',
  async () => {
    const database = new DatabaseService();
    const fotografias = new FotografiasRepository();
    const pendientes = new ArchivosPendientesRepository();
    const actividades = new ActividadesRepository();

    const idUsuario = randomUUID();
    const idProyecto = randomUUID();
    const idActorInexistente = randomUUID();

    const claves = [
      `fotografias/${randomUUID()}.jpeg`,
      `fotografias/${randomUUID()}.webp`,
    ];

    let conexionInicializada = false;

    try {
      await database.onModuleInit();
      conexionInicializada = true;

      // Confirmamos la preparación antes de provocar las reversiones.
      const original = await database.withTransaction(async (client) => {
        await client.query(
          `
            INSERT INTO obra.usuarios (
              id_usuario, correo, google_sub
            )
            VALUES ($1, $2, $3)
          `,
          [
            idUsuario,
            `${idUsuario}@example.invalid`,
            `integracion-${idUsuario}`,
          ],
        );

        await client.query(
          `
            INSERT INTO obra.proyectos (
              id_proyecto,
              id_propietario,
              nombre,
              descripcion,
              direccion,
              contratante,
              fecha_inicio,
              estado_proyecto
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            idProyecto,
            idUsuario,
            'Proyecto temporal',
            'Prueba de reversión de eliminación',
            'Dirección temporal',
            'Contratante temporal',
            '2026-09-14',
            'ACTIVA',
          ],
        );

        return fotografias.crear(client, {
          idProyecto,
          idUsuarioSubida: idUsuario,
          titulo: 'Fotografía que debe conservarse',
          url: '/fotografia-temporal.webp',
          originalS3Key: claves[0],
          s3Key: claves[1],
        });
      });

      for (const etapa of ['cola', 'actividad']) {
        let pendientesObservados = false;
        let actividadIntentada = false;

        const servicio = new FotografiasEliminacionService(
          database,
          new FotografiasAccesoRepository(),
          fotografias,
          {
            async registrar(client, clavesRecibidas) {
              await pendientes.registrar(client, clavesRecibidas);

              /*
               * Confirmamos que el DELETE y las dos inserciones
               * ya ocurrieron dentro de la transacción.
               */
              const foto = await client.query(
                `
                  SELECT id_fotografia
                  FROM obra.fotografias
                  WHERE id_fotografia = $1
                `,
                [original.id_fotografia],
              );

              const tareas = await client.query(
                `
                  SELECT s3_key
                  FROM obra.archivos_pendientes_eliminacion
                  WHERE s3_key = ANY($1::text[])
                `,
                [claves],
              );

              assert.equal(foto.rowCount, 0);
              assert.equal(tareas.rowCount, 2);
              pendientesObservados = true;

              if (etapa === 'cola') {
                /*
                 * Fallo SQL deliberado, exclusivo de la prueba:
                 * la clave primaria no permite NULL.
                 */
                await client.query(
                  `
                    INSERT INTO obra.archivos_pendientes_eliminacion
                      (s3_key)
                    VALUES (NULL)
                  `,
                );
              }
            },
          },
          {
            async crear(client, datos) {
              actividadIntentada = true;

              // El INSERT real falla por la clave foránea del actor.
              return actividades.crear(client, {
                ...datos,
                idActor: idActorInexistente,
              });
            },
          },
        );

        await assert.rejects(
          () =>
            servicio.eliminar(
              idProyecto,
              original.id_fotografia,
              idUsuario,
            ),
          (error) => {
            assert.equal(
              error.code,
              etapa === 'cola' ? '23502' : '23503',
            );
            return true;
          },
        );

        assert.equal(pendientesObservados, true);
        assert.equal(actividadIntentada, etapa === 'actividad');

        /*
         * Estas consultas ocurren después del ROLLBACK real,
         * fuera de la transacción fallida.
         */
        const restaurada = await database.query(
          `
            SELECT
              id_fotografia, id_proyecto, id_usuario_subida,
              titulo, url, s3_key, original_s3_key, latitud, longitud, fecha_subida
            FROM obra.fotografias
            WHERE id_fotografia = $1
          `,
          [original.id_fotografia],
        );

        assert.deepEqual(restaurada.rows, [original]);

        const tareasFinales = await database.query(
          `
            SELECT s3_key
            FROM obra.archivos_pendientes_eliminacion
            WHERE s3_key = ANY($1::text[])
          `,
          [claves],
        );

        assert.equal(tareasFinales.rowCount, 0);

        const historial = await database.query(
          `
            SELECT id_actividad
            FROM obra.actividades
            WHERE id_proyecto = $1
          `,
          [idProyecto],
        );

        assert.equal(historial.rowCount, 0);
      }
    } finally {
      if (conexionInicializada) {
        try {
          await database.withTransaction(async (client) => {
            await client.query(
              'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
              [idProyecto],
            );

            await client.query(
              `
                DELETE FROM obra.archivos_pendientes_eliminacion
                WHERE s3_key = ANY($1::text[])
              `,
              [claves],
            );

            await client.query(
              'DELETE FROM obra.usuarios WHERE id_usuario = $1',
              [idUsuario],
            );
          });
        } finally {
          await database.onApplicationShutdown();
        }
      }
    }
  },
);