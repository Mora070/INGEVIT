require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { NotFoundException } = require('@nestjs/common');

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

test('eliminación lógica: conserva el proyecto y sus relaciones, pero bloquea su consulta', async () => {
  const database = new DatabaseService();
  const rollbackDeLimpieza = new Error('Reversión controlada');

  try {
    await assert.rejects(
      () =>
        database.withTransaction(async (client) => {
          async function crearUsuario(rol = 'USUARIO') {
            const idUsuario = randomUUID();

            await client.query(
              `
                INSERT INTO obra.usuarios (
                  id_usuario, correo, google_sub, rol, estado
                )
                VALUES (
                  $1::uuid, $2, $3, $4::obra.rol_usuario, 'ACTIVO'
                )
              `,
              [
                idUsuario,
                `eliminacion-${idUsuario}@example.test`,
                `google-ficticio-${idUsuario}`,
                rol,
              ],
            );

            return idUsuario;
          }

          const propietario = await crearUsuario();
          const colaborador = await crearUsuario();
          const administrador = await crearUsuario('ADMINISTRADOR');

          /**
           * Las lecturas y escrituras utilizan la misma transacción.
           * El adaptador permite inspeccionar los datos antes de revertirlos.
           */
          const repository = new ProyectosRepository({
            query(sql, values) {
              return client.query(sql, values);
            },
          });

          const service = new ProyectosService(
            repository,
            {
              withTransaction(operation) {
                return operation(client);
              },
            },
            new ActividadesRepository(),
          );

          const proyecto = await service.crear(propietario, {
            nombre: 'Proyecto temporal',
            descripcion: 'Descripción de prueba',
            direccion: 'Dirección de prueba',
            contratante: 'Cliente de prueba',
            fecha_inicio: '2026-09-09',
            estado_proyecto: 'PAUSA',
          });

          await client.query(
            `
              INSERT INTO obra.usuario_proyecto (
                id_usuario, id_proyecto
              )
              VALUES ($1::uuid, $2::uuid)
            `,
            [colaborador, proyecto.id_proyecto],
          );

          const original = await client.query(
            `
              SELECT *
              FROM obra.proyectos
              WHERE id_proyecto = $1::uuid
            `,
            [proyecto.id_proyecto],
          );

          const historialOriginal = await client.query(
            `
              SELECT *
              FROM obra.actividades
              WHERE id_proyecto = $1::uuid
            `,
            [proyecto.id_proyecto],
          );

          assert.equal(historialOriginal.rows.length, 1);

          // Ni colaborar ni ser administrador concede propiedad.
          for (const solicitante of [colaborador, administrador]) {
            await assert.rejects(
              () =>
                service.eliminarLogicamente(
                  proyecto.id_proyecto,
                  solicitante,
                ),
              (error) => {
                assert.ok(error instanceof NotFoundException);
                assert.equal(error.getStatus(), 404);
                return true;
              },
            );
          }

          // El propietario ejecuta la eliminación lógica.
          await service.eliminarLogicamente(
            proyecto.id_proyecto,
            propietario,
          );

          const conservado = await client.query(
            `
              SELECT *
              FROM obra.proyectos
              WHERE id_proyecto = $1::uuid
            `,
            [proyecto.id_proyecto],
          );

          // Todos los campos permanecen iguales excepto activo.
          assert.deepEqual(conservado.rows, [
            {
              ...original.rows[0],
              activo: false,
            },
          ]);

          const colaboradores = await client.query(
            `
              SELECT id_usuario
              FROM obra.usuario_proyecto
              WHERE id_proyecto = $1::uuid
            `,
            [proyecto.id_proyecto],
          );

          assert.deepEqual(colaboradores.rows, [
            { id_usuario: colaborador },
          ]);

          const historialFinal = await client.query(
            `
              SELECT *
              FROM obra.actividades
              WHERE id_proyecto = $1::uuid
            `,
            [proyecto.id_proyecto],
          );

          assert.equal(historialFinal.rows.length, 2);

          // La actividad anterior se conserva sin modificaciones.
          const actividadAnterior = historialFinal.rows.find(
            (fila) =>
              fila.id_actividad ===
              historialOriginal.rows[0].id_actividad,
          );

          assert.deepEqual(
            actividadAnterior,
            historialOriginal.rows[0],
          );

          const eliminacion = historialFinal.rows.find(
            (fila) =>
              fila.tipo_accion === 'PROYECTO_ELIMINADO_LOGICAMENTE',
          );

          assert.ok(eliminacion);
          assert.equal(eliminacion.id_actor, propietario);
          assert.equal(
            eliminacion.mensaje,
            'Proyecto eliminado lógicamente.',
          );

          // El proyecto desaparece del listado y del detalle para ambos.
          for (const solicitante of [propietario, colaborador]) {
            assert.deepEqual(
              await repository.findDisponiblesPaginadosByUsuario(
                solicitante,
                1,
                20,
              ),
              { proyectos: [], total: 0 },
            );

            assert.equal(
              await repository.findDisponibleById(
                proyecto.id_proyecto,
                solicitante,
              ),
              null,
            );
          }

          // Repetir la eliminación devuelve 404.
          await assert.rejects(
            () =>
              service.eliminarLogicamente(
                proyecto.id_proyecto,
                propietario,
              ),
            (error) => {
              assert.ok(error instanceof NotFoundException);
              assert.equal(error.getStatus(), 404);
              return true;
            },
          );

          // La repetición no agrega otra actividad.
          const conteo = await client.query(
            `
              SELECT count(*)::integer AS cantidad
              FROM obra.actividades
              WHERE id_proyecto = $1::uuid
            `,
            [proyecto.id_proyecto],
          );

          assert.equal(conteo.rows[0].cantidad, 2);

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