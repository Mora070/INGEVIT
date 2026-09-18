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

test('colaboradores: incorpora cuentas existentes sin duplicar relaciones ni actividades', async () => {
  const database = new DatabaseService();
  const rollbackDeLimpieza = new Error('Reversión controlada');

  try {
    await assert.rejects(
      () =>
        database.withTransaction(async (client) => {
          async function crearUsuario(
            rol = 'USUARIO',
            estado = 'ACTIVO',
          ) {
            const idUsuario = randomUUID();

            await client.query(
              `
                INSERT INTO obra.usuarios (
                  id_usuario, correo, google_sub, rol, estado
                )
                VALUES (
                  $1::uuid,
                  $2,
                  $3,
                  $4::obra.rol_usuario,
                  $5::obra.estado_usuario
                )
              `,
              [
                idUsuario,
                `colaborador-${idUsuario}@example.test`,
                `google-ficticio-${idUsuario}`,
                rol,
                estado,
              ],
            );

            return idUsuario;
          }

          const propietario = await crearUsuario();
          const colaborador = await crearUsuario();
          const destinatarioInactivo = await crearUsuario(
            'USUARIO',
            'INACTIVO',
          );
          const administrador = await crearUsuario('ADMINISTRADOR');

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
            nombre: 'Proyecto de colaboradores',
            descripcion: 'Descripción de prueba',
            direccion: 'Dirección de prueba',
            contratante: 'Cliente de prueba',
            fecha_inicio: '2026-09-09',
            estado_proyecto: 'ACTIVA',
          });

          // 1. El propietario incorpora un colaborador.
          await service.agregarColaborador(
            proyecto.id_proyecto,
            propietario,
            colaborador,
          );

          // 2. Repetir la incorporación no debe duplicar nada.
          await service.agregarColaborador(
            proyecto.id_proyecto,
            propietario,
            colaborador,
          );

          const relacion = await client.query(
            `
              SELECT id_usuario, id_proyecto
              FROM obra.usuario_proyecto
              WHERE id_proyecto = $1::uuid
                AND id_usuario = $2::uuid
            `,
            [proyecto.id_proyecto, colaborador],
          );

          assert.deepEqual(relacion.rows, [
            {
              id_usuario: colaborador,
              id_proyecto: proyecto.id_proyecto,
            },
          ]);

          const actividad = await client.query(
            `
              SELECT id_actor, mensaje
              FROM obra.actividades
              WHERE id_proyecto = $1::uuid
                AND tipo_accion = 'COLABORADOR_AGREGADO'
            `,
            [proyecto.id_proyecto],
          );

          assert.deepEqual(actividad.rows, [
            {
              id_actor: propietario,
              mensaje:
                `Usuario ${colaborador} agregado como colaborador.`,
            },
          ]);

          // La incorporación concede acceso al proyecto disponible.
          assert.ok(
            await repository.findDisponibleById(
              proyecto.id_proyecto,
              colaborador,
            ),
          );

          // 3. El colaborador y un administrador ajeno no pueden incorporar.
          for (const solicitante of [colaborador, administrador]) {
            await assert.rejects(
              () =>
                service.agregarColaborador(
                  proyecto.id_proyecto,
                  solicitante,
                  destinatarioInactivo,
                ),
              (error) => {
                assert.ok(error instanceof NotFoundException);
                assert.equal(
                  error.message,
                  'El proyecto no está disponible para gestionar colaboradores.',
                );
                return true;
              },
            );
          }

          // 4. Una cuenta inexistente no se puede incorporar.
          const idInexistente = randomUUID();

          await assert.rejects(
            () =>
              service.agregarColaborador(
                proyecto.id_proyecto,
                propietario,
                idInexistente,
              ),
            (error) => {
              assert.ok(error instanceof NotFoundException);
              assert.equal(
                error.message,
                'El usuario que deseas agregar no existe.',
              );
              return true;
            },
          );

          // 5. El propietario puede incorporar una cuenta inactiva.
          await service.agregarColaborador(
            proyecto.id_proyecto,
            propietario,
            destinatarioInactivo,
          );

          const cuenta = await client.query(
            `
              SELECT rol, estado
              FROM obra.usuarios
              WHERE id_usuario = $1::uuid
            `,
            [destinatarioInactivo],
          );

          assert.deepEqual(cuenta.rows, [
            { rol: 'USUARIO', estado: 'INACTIVO' },
          ]);

          // La relación no activa la cuenta ni le permite acceder.
          assert.equal(
            await repository.findDisponibleById(
              proyecto.id_proyecto,
              destinatarioInactivo,
            ),
            null,
          );

          // Reactivarla permite utilizar la relación ya existente.
          await client.query(
            `
              UPDATE obra.usuarios
              SET estado = 'ACTIVO'
              WHERE id_usuario = $1::uuid
            `,
            [destinatarioInactivo],
          );

          assert.ok(
            await repository.findDisponibleById(
              proyecto.id_proyecto,
              destinatarioInactivo,
            ),
          );

          // 6. Solo hay dos relaciones y dos actividades de incorporación.
          const relacionesFinales = await client.query(
            `
              SELECT id_usuario
              FROM obra.usuario_proyecto
              WHERE id_proyecto = $1::uuid
              ORDER BY id_usuario
            `,
            [proyecto.id_proyecto],
          );

          assert.deepEqual(
            relacionesFinales.rows.map((fila) => fila.id_usuario),
            [colaborador, destinatarioInactivo].sort(),
          );

          const conteoHistorial = await client.query(
            `
              SELECT count(*)::integer AS cantidad
              FROM obra.actividades
              WHERE id_proyecto = $1::uuid
                AND tipo_accion = 'COLABORADOR_AGREGADO'
            `,
            [proyecto.id_proyecto],
          );

          assert.equal(conteoHistorial.rows[0].cantidad, 2);

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