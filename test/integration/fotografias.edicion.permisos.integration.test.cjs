require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { NotFoundException } = require('@nestjs/common');

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
  FotografiasEdicionService,
} = require('../../dist/modules/fotografias/fotografias-edicion.service');

const {
  ActividadesRepository,
} = require('../../dist/modules/actividades/actividades.repository');

test(
  'edición fotografía: permite al colaborador y rechaza al retirado y al administrador ajeno',
  async () => {
    const database = new DatabaseService();
    const finalizar = new Error('Revertir datos de integración');

    try {
      await database.onModuleInit();

      await assert.rejects(
        () =>
          database.withTransaction(async (client) => {
            const idPropietario = randomUUID();
            const idColaborador = randomUUID();
            const idAdministrador = randomUUID();
            const idProyecto = randomUUID();

            for (const [idUsuario, rol] of [
              [idPropietario, 'USUARIO'],
              [idColaborador, 'USUARIO'],
              [idAdministrador, 'ADMINISTRADOR'],
            ]) {
              await client.query(
                `
                  INSERT INTO obra.usuarios (
                    id_usuario, correo, google_sub, rol
                  )
                  VALUES ($1, $2, $3, $4)
                `,
                [
                  idUsuario,
                  `${idUsuario}@example.invalid`,
                  `integracion-${idUsuario}`,
                  rol,
                ],
              );
            }

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
                idPropietario,
                'Proyecto temporal',
                'Prueba de permisos de edición',
                'Dirección temporal',
                'Contratante temporal',
                '2026-09-14',
                'ACTIVA',
              ],
            );

            await client.query(
              `
                INSERT INTO obra.usuario_proyecto (
                  id_usuario, id_proyecto
                )
                VALUES ($1, $2)
              `,
              [idColaborador, idProyecto],
            );

            const fotografias = new FotografiasRepository();

            const original = await fotografias.crear(client, {
              idProyecto,
              idUsuarioSubida: idPropietario,
              titulo: 'Título original',
              url: '/fotografia-temporal.webp',
              s3Key: `fotografias/${randomUUID()}.webp`,
              originalS3Key: `fotografias/${randomUUID()}.jpeg`,
            });

            /*
             * Todas las consultas utilizan la transacción exterior.
             * Esta prueba comprueba permisos con SQL real.
             * La confirmación y reversión reales se prueban por separado.
             */
            const servicio = new FotografiasEdicionService(
              {
                withTransaction: (operacion) => operacion(client),
              },
              new FotografiasAccesoRepository(),
              fotografias,
              new ActividadesRepository(),
            );

            const editada = await servicio.actualizarTitulo(
              idProyecto,
              original.id_fotografia,
              idColaborador,
              { titulo: 'Título guardado por colaborador' },
            );

            assert.equal(
              editada.titulo,
              'Título guardado por colaborador',
            );

            // Editar no convierte al colaborador en autor de la foto.
            assert.equal(
              editada.id_usuario_subida,
              idPropietario,
            );

            await client.query(
              `
                DELETE FROM obra.usuario_proyecto
                WHERE id_usuario = $1
                  AND id_proyecto = $2
              `,
              [idColaborador, idProyecto],
            );

            /*
             * Ambos solicitantes deben quedar fuera:
             * - Colaborador retirado.
             * - Administrador sin relación con el proyecto.
             */
            for (const idSolicitante of [
              idColaborador,
              idAdministrador,
            ]) {
              await assert.rejects(
                () =>
                  servicio.actualizarTitulo(
                    idProyecto,
                    original.id_fotografia,
                    idSolicitante,
                    { titulo: 'Cambio rechazado' },
                  ),
                (error) => {
                  assert.ok(error instanceof NotFoundException);
                  assert.equal(error.getStatus(), 404);
                  return true;
                },
              );
            }

            const resultado = await client.query(
              `
                SELECT titulo, id_usuario_subida
                FROM obra.fotografias
                WHERE id_fotografia = $1
              `,
              [original.id_fotografia],
            );

            assert.deepEqual(resultado.rows, [
              {
                titulo: 'Título guardado por colaborador',
                id_usuario_subida: idPropietario,
              },
            ]);

            const historial = await client.query(
              `
                SELECT id_actor, tipo_accion
                FROM obra.actividades
                WHERE id_proyecto = $1
              `,
              [idProyecto],
            );

            // Solo el guardado autorizado genera actividad.
            assert.deepEqual(historial.rows, [
              {
                id_actor: idColaborador,
                tipo_accion: 'FOTOGRAFIA_TITULO_GUARDADO',
              },
            ]);

            throw finalizar;
          }),
        (error) => {
          assert.strictEqual(error, finalizar);
          return true;
        },
      );
    } finally {
      await database.onApplicationShutdown();
    }
  },
);