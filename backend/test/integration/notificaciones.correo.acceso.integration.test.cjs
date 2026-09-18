require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  NotificacionesCorreoRepository,
} = require(
  '../../dist/modules/notificaciones/correos/notificaciones-correo.repository'
);

/**
 * Comprueba los permisos y datos actuales del destinatario.
 *
 * Todo se ejecuta en una transacción que se revierte al finalizar.
 * No reserva filas ajenas ni envía correos.
 */
test('correo: exige reserva vigente y acceso actual del destinatario', async () => {
  const database = new DatabaseService();
  const repository = new NotificacionesCorreoRepository();

  const propietario = randomUUID();
  const colaborador = randomUUID();
  const proyecto = randomUUID();
  const notificacion = randomUUID();
  const reserva = randomUUID();

  const finPrueba = new Error('Reversión deliberada');

  await database.onModuleInit();

  try {
    await assert.rejects(
      database.withTransaction(async (client) => {
        for (const id of [propietario, colaborador]) {
          await client.query(
            `
              INSERT INTO obra.usuarios (
                id_usuario, correo, google_sub
              )
              VALUES ($1, $2, $3)
            `,
            [
              id,
              `${id}@example.invalid`,
              `correo-acceso-${id}`,
            ],
          );
        }

        await client.query(
          `
            INSERT INTO obra.proyectos (
              id_proyecto, id_propietario, nombre,
              descripcion, direccion, contratante,
              fecha_inicio, estado_proyecto
            )
            VALUES (
              $1, $2, 'Proyecto temporal',
              'Acceso a correos', 'Dirección temporal',
              'Contratante temporal', CURRENT_DATE, 'ACTIVA'
            )
          `,
          [proyecto, propietario],
        );

        await client.query(
          `
            INSERT INTO obra.usuario_proyecto (
              id_usuario, id_proyecto
            )
            VALUES ($1, $2)
          `,
          [colaborador, proyecto],
        );

        // Creamos una reserva propia sin seleccionar la cola global.
        await client.query(
          `
            INSERT INTO obra.notificaciones (
              id_notificacion, id_receptor, id_actor,
              id_proyecto, tipo, titulo, mensaje,
              correo_reserva, correo_reservado_hasta,
              correo_intentos
            )
            VALUES (
              $1, $2, $3, $4,
              'INCIDENCIA_CREADA',
              'Incidencia creada',
              'Fisura en el acceso.',
              $5,
              clock_timestamp() + INTERVAL '5 minutes',
              1
            )
          `,
          [
            notificacion,
            colaborador,
            propietario,
            proyecto,
            reserva,
          ],
        );

        const consultar = () => repository.obtenerDatosParaEnvio(
          client,
          notificacion,
          reserva,
        );

        assert.deepEqual(await consultar(), {
          id_notificacion: notificacion,
          tipo: 'INCIDENCIA_CREADA',
          titulo: 'Incidencia creada',
          mensaje: 'Fisura en el acceso.',
          correo_receptor: `${colaborador}@example.invalid`,
        });

        // No utiliza una dirección guardada durante la reserva.
        const nuevoCorreo = `actualizado-${colaborador}@example.invalid`;

        await client.query(
          'UPDATE obra.usuarios SET correo = $2 WHERE id_usuario = $1',
          [colaborador, nuevoCorreo],
        );

        assert.equal(
          (await consultar()).correo_receptor,
          nuevoCorreo,
        );

        assert.equal(
          await repository.obtenerDatosParaEnvio(
            client,
            notificacion,
            randomUUID(),
          ),
          null,
        );

        assert.equal(
          await repository.obtenerDatosParaEnvio(
            client,
            randomUUID(),
            reserva,
          ),
          null,
        );

        // Receptor inactivo.
        await client.query(
          "UPDATE obra.usuarios SET estado = 'INACTIVO' WHERE id_usuario = $1",
          [colaborador],
        );
        assert.equal(await consultar(), null);

        await client.query(
          "UPDATE obra.usuarios SET estado = 'ACTIVO' WHERE id_usuario = $1",
          [colaborador],
        );

        // Propietario inactivo.
        await client.query(
          "UPDATE obra.usuarios SET estado = 'INACTIVO' WHERE id_usuario = $1",
          [propietario],
        );
        assert.equal(await consultar(), null);

        await client.query(
          "UPDATE obra.usuarios SET estado = 'ACTIVO' WHERE id_usuario = $1",
          [propietario],
        );

        // Proyecto retirado.
        await client.query(
          'UPDATE obra.proyectos SET activo = FALSE WHERE id_proyecto = $1',
          [proyecto],
        );
        assert.equal(await consultar(), null);

        await client.query(
          'UPDATE obra.proyectos SET activo = TRUE WHERE id_proyecto = $1',
          [proyecto],
        );

        // Colaborador retirado del proyecto.
        await client.query(
          `
            DELETE FROM obra.usuario_proyecto
            WHERE id_usuario = $1 AND id_proyecto = $2
          `,
          [colaborador, proyecto],
        );
        assert.equal(await consultar(), null);

        // El propietario tiene acceso sin pertenecer a usuario_proyecto.
        // Cambiamos también el actor para no crear una autonotificación.
        await client.query(
          `
            UPDATE obra.notificaciones
            SET id_receptor = $2, id_actor = $3
            WHERE id_notificacion = $1
          `,
          [notificacion, propietario, colaborador],
        );

        assert.equal(
          (await consultar()).correo_receptor,
          `${propietario}@example.invalid`,
        );

        // Una reserva vencida no autoriza el envío.
        await client.query(
          `
            UPDATE obra.notificaciones
            SET correo_reservado_hasta =
              clock_timestamp() - INTERVAL '1 second'
            WHERE id_notificacion = $1
          `,
          [notificacion],
        );
        assert.equal(await consultar(), null);

        // Una notificación finalizada tampoco puede enviarse otra vez.
        await client.query(
          `
            UPDATE obra.notificaciones
            SET
              estado_envio_correo = 'ENVIADA',
              correo_reserva = NULL,
              correo_reservado_hasta = NULL
            WHERE id_notificacion = $1
          `,
          [notificacion],
        );
        assert.equal(await consultar(), null);

        throw finPrueba;
      }),
      (error) => error === finPrueba,
    );
  } finally {
    await database.onApplicationShutdown();
  }
});