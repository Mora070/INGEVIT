require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  ProyectosRepository,
} = require('../../dist/modules/proyectos/proyectos.repository');

const {
  ProyectosService,
} = require('../../dist/modules/proyectos/proyectos.service');

const {
  ActividadesRepository,
} = require('../../dist/modules/actividades/actividades.repository');

test('actualizar proyecto: revierte el UPDATE cuando falla la actividad', async () => {
  const database = new DatabaseService();
  const rollbackDeLimpieza = new Error('Reversión controlada');

  try {
    await assert.rejects(
      () =>
        database.withTransaction(async (client) => {
          const propietario = randomUUID();
          const actorInexistente = randomUUID();

          await client.query(
            `
              INSERT INTO obra.usuarios (
                id_usuario,
                correo,
                google_sub,
                rol,
                estado
              )
              VALUES (
                $1::uuid,
                $2,
                $3,
                'USUARIO',
                'ACTIVO'
              )
            `,
            [
              propietario,
              `rollback-edicion-${propietario}@example.test`,
              `google-ficticio-${propietario}`,
            ],
          );

          const actor = await client.query(
            `
              SELECT id_usuario
              FROM obra.usuarios
              WHERE id_usuario = $1::uuid
            `,
            [actorInexistente],
          );

          assert.equal(actor.rows.length, 0);

          const proyectosRepository =
            new ProyectosRepository(database);
          const actividadesRepository =
            new ActividadesRepository();

          /**
           * La preparación pertenece a la transacción exterior.
           * Crearemos el SAVEPOINT después de estos registros.
           */
          const original = await proyectosRepository.crear(client, {
            idPropietario: propietario,
            nombre: 'Proyecto original',
            descripcion: 'Descripción original',
            direccion: 'Dirección original',
            contratante: 'Cliente original',
            fechaInicio: '2026-09-01',
            fechaFinalizacion: '2026-12-31',
            estadoProyecto: 'ACTIVA',
            latitud: 4.711,
            longitud: -74.0721,
          });

          await actividadesRepository.crear(client, {
            idProyecto: original.id_proyecto,
            idActor: propietario,
            tipoAccion: 'PROYECTO_CREADO',
            mensaje: 'Proyecto creado.',
          });

          const historialOriginal = await client.query(
            `
              SELECT *
              FROM obra.actividades
              WHERE id_proyecto = $1::uuid
              ORDER BY id_actividad
            `,
            [original.id_proyecto],
          );

          /**
           * Adaptador exclusivo de esta prueba.
           *
           * Un SAVEPOINT permite revertir la edición y conservar
           * temporalmente la preparación para comparar sus valores.
           * No modifica DatabaseService ni su comportamiento productivo.
           */
          const transaccionDeEdicion = {
            async withTransaction(operation) {
              await client.query('SAVEPOINT prueba_edicion');

              try {
                const resultado = await operation(client);
                await client.query('RELEASE SAVEPOINT prueba_edicion');
                return resultado;
              } catch (error) {
                await client.query(
                  'ROLLBACK TO SAVEPOINT prueba_edicion',
                );
                await client.query(
                  'RELEASE SAVEPOINT prueba_edicion',
                );
                throw error;
              }
            },
          };

          const actividadesConFallo = {
            async crear(cliente, datos) {
              assert.strictEqual(cliente, client);
              assert.equal(datos.idActor, propietario);

              // Demuestra que el UPDATE se ejecutó antes del fallo.
              const duranteEdicion = await client.query(
                `
                  SELECT nombre, estado_proyecto
                  FROM obra.proyectos
                  WHERE id_proyecto = $1::uuid
                `,
                [original.id_proyecto],
              );

              assert.deepEqual(duranteEdicion.rows, [
                {
                  nombre: 'Nombre que debe revertirse',
                  estado_proyecto: 'PAUSA',
                },
              ]);

              // Provoca un error real de clave foránea en PostgreSQL.
              return actividadesRepository.crear(cliente, {
                ...datos,
                idActor: actorInexistente,
              });
            },
          };

          const service = new ProyectosService(
            proyectosRepository,
            transaccionDeEdicion,
            actividadesConFallo,
          );

          await assert.rejects(
            () =>
              service.actualizar(
                original.id_proyecto,
                propietario,
                {
                  nombre: 'Nombre que debe revertirse',
                  descripcion: 'Descripción modificada',
                  direccion: 'Dirección modificada',
                  contratante: 'Cliente modificado',
                  fecha_inicio: '2026-09-09',
                  estado_proyecto: 'PAUSA',
                },
              ),
            (error) => {
              assert.equal(error.code, '23503');
              assert.equal(
                error.constraint,
                'actividades_id_actor_fkey',
              );
              return true;
            },
          );

          /**
           * Leemos mediante el mismo cliente, después del rollback.
           * La consulta devuelve la proyección usada por ProyectoRow.
           */
          const restaurado =
            await proyectosRepository.bloquearEditablePorPropietario(
              client,
              original.id_proyecto,
              propietario,
            );

          assert.deepEqual(restaurado, original);

          // El historial previo permanece y no aparece una edición fallida.
          const historialFinal = await client.query(
            `
              SELECT *
              FROM obra.actividades
              WHERE id_proyecto = $1::uuid
              ORDER BY id_actividad
            `,
            [original.id_proyecto],
          );

          assert.deepEqual(
            historialFinal.rows,
            historialOriginal.rows,
          );

          throw rollbackDeLimpieza;
        }),
      (error) => {
        assert.strictEqual(error, rollbackDeLimpieza);
        return true;
      },
    );
  } finally {
    await database.onApplicationShutdown();
  }
});