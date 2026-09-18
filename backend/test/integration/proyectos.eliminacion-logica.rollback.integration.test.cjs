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

test('eliminación lógica: restaura el proyecto si falla la actividad', async () => {
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
                id_usuario, correo, google_sub, rol, estado
              )
              VALUES ($1::uuid, $2, $3, 'USUARIO', 'ACTIVO')
            `,
            [
              propietario,
              `rollback-eliminacion-${propietario}@example.test`,
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

          const repository = new ProyectosRepository({
            query(sql, values) {
              return client.query(sql, values);
            },
          });

          const actividadesRepository = new ActividadesRepository();

          // Preparación anterior al SAVEPOINT.
          const original = await repository.crear(client, {
            idPropietario: propietario,
            nombre: 'Proyecto que debe conservarse',
            descripcion: 'Descripción de prueba',
            direccion: 'Dirección de prueba',
            contratante: 'Cliente de prueba',
            fechaInicio: '2026-09-09',
            fechaFinalizacion: null,
            estadoProyecto: 'ACTIVA',
            latitud: null,
            longitud: null,
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
           * Adaptador exclusivo de la prueba.
           * Revierte la operación sin perder la preparación.
           */
          const transaccionDePrueba = {
            async withTransaction(operation) {
              await client.query('SAVEPOINT prueba_eliminacion');

              try {
                const resultado = await operation(client);
                await client.query(
                  'RELEASE SAVEPOINT prueba_eliminacion',
                );
                return resultado;
              } catch (error) {
                await client.query(
                  'ROLLBACK TO SAVEPOINT prueba_eliminacion',
                );
                await client.query(
                  'RELEASE SAVEPOINT prueba_eliminacion',
                );
                throw error;
              }
            },
          };

          const actividadesConFallo = {
            async crear(cliente, datos) {
              assert.strictEqual(cliente, client);
              assert.equal(datos.idActor, propietario);
              assert.equal(
                datos.tipoAccion,
                'PROYECTO_ELIMINADO_LOGICAMENTE',
              );

              // Confirma que el cambio ocurrió antes del fallo.
              const duranteOperacion = await client.query(
                `
                  SELECT activo
                  FROM obra.proyectos
                  WHERE id_proyecto = $1::uuid
                `,
                [original.id_proyecto],
              );

              assert.deepEqual(duranteOperacion.rows, [
                { activo: false },
              ]);

              // Provoca una infracción real de clave foránea.
              return actividadesRepository.crear(cliente, {
                ...datos,
                idActor: actorInexistente,
              });
            },
          };

          const service = new ProyectosService(
            repository,
            transaccionDePrueba,
            actividadesConFallo,
          );

          await assert.rejects(
            () =>
              service.eliminarLogicamente(
                original.id_proyecto,
                propietario,
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

          // Tras revertir, el proyecto vuelve a ser accesible.
          const restaurado = await repository.findDisponibleById(
            original.id_proyecto,
            propietario,
          );

          assert.deepEqual(restaurado, original);
          assert.equal(restaurado.activo, true);

          const listado =
            await repository.findDisponiblesPaginadosByUsuario(
              propietario,
              1,
              20,
            );

          assert.equal(listado.total, 1);
          assert.deepEqual(
            listado.proyectos.map((proyecto) => proyecto.id_proyecto),
            [original.id_proyecto],
          );

          // El historial anterior permanece sin registros adicionales.
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