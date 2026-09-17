require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  UsuariosAvatarAccesoRepository,
} = require('../../dist/modules/usuarios/usuarios-avatar-acceso.repository');

/**
 * Ejecuta el SQL real dentro de una transacción que se revierte.
 * No crea archivos ni inicia trabajadores.
 */
test('avatar: limita la visibilidad a la cuenta propia y participantes activos de un proyecto disponible', async () => {
  const database = new DatabaseService();
  const finalizar = new Error('Reversión deliberada');

  await database.onModuleInit();

  try {
    await assert.rejects(
      database.withTransaction(async (client) => {
        const repository = new UsuariosAvatarAccesoRepository({
          query: (sql, valores) => client.query(sql, valores),
        });

        const propietario = randomUUID();
        const colaborador = randomUUID();
        const segundoColaborador = randomUUID();
        const ajeno = randomUUID();
        const proyecto = randomUUID();

        const claves = new Map();

        for (const id of [
          propietario,
          colaborador,
          segundoColaborador,
          ajeno,
        ]) {
          const clave = `avatares/${randomUUID()}.webp`;
          claves.set(id, clave);

          await client.query(
            `
              INSERT INTO obra.usuarios (
                id_usuario, correo, google_sub,
                foto_perfil_url, foto_perfil_key
              )
              VALUES ($1, $2, $3, $4, $5)
            `,
            [
              id,
              `${id}@example.invalid`,
              `avatar-acceso-${id}`,
              `/api/usuarios/${id}/avatar`,
              clave,
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
              $1, $2, 'Proyecto de prueba', 'Permisos de avatares',
              'Dirección de prueba', 'Contratante de prueba',
              '2026-09-16', 'ACTIVA'
            )
          `,
          [proyecto, propietario],
        );

        for (const id of [colaborador, segundoColaborador]) {
          await client.query(
            `
              INSERT INTO obra.usuario_proyecto (id_usuario, id_proyecto)
              VALUES ($1, $2)
            `,
            [id, proyecto],
          );
        }

        async function comprobar(titular, solicitante, permitido) {
          assert.equal(
            await repository.buscarDisponible(titular, solicitante),
            permitido ? claves.get(titular) : null,
            `Acceso de ${solicitante} al avatar de ${titular}`,
          );
        }

        // Acceso propio, incluso sin pertenecer a ningún proyecto.
        await comprobar(propietario, propietario, true);
        await comprobar(ajeno, ajeno, true);

        // Propietario y colaboradores pueden verse mutuamente.
        await comprobar(propietario, colaborador, true);
        await comprobar(colaborador, propietario, true);
        await comprobar(colaborador, segundoColaborador, true);
        await comprobar(segundoColaborador, colaborador, true);

        // No compartir proyecto impide consultar el avatar.
        await comprobar(colaborador, ajeno, false);
        await comprobar(ajeno, colaborador, false);

        assert.equal(
          await repository.buscarDisponible(randomUUID(), colaborador),
          null,
        );

        assert.equal(
          await repository.buscarDisponible(colaborador, randomUUID()),
          null,
        );

        // Un proyecto inactivo ya no concede visibilidad entre cuentas.
        await client.query(
          'UPDATE obra.proyectos SET activo = FALSE WHERE id_proyecto = $1',
          [proyecto],
        );

        await comprobar(colaborador, segundoColaborador, false);
        await comprobar(propietario, colaborador, false);
        await comprobar(colaborador, colaborador, true);

        await client.query(
          'UPDATE obra.proyectos SET activo = TRUE WHERE id_proyecto = $1',
          [proyecto],
        );

        // El propietario inactivo vuelve indisponible el proyecto.
        await client.query(
          "UPDATE obra.usuarios SET estado = 'INACTIVO' WHERE id_usuario = $1",
          [propietario],
        );

        await comprobar(colaborador, segundoColaborador, false);
        await comprobar(propietario, colaborador, false);

        await client.query(
          "UPDATE obra.usuarios SET estado = 'ACTIVO' WHERE id_usuario = $1",
          [propietario],
        );

        // Una cuenta inactiva no puede ver avatares ni mostrar el suyo.
        await client.query(
          "UPDATE obra.usuarios SET estado = 'INACTIVO' WHERE id_usuario = $1",
          [colaborador],
        );

        await comprobar(segundoColaborador, colaborador, false);
        await comprobar(colaborador, segundoColaborador, false);
        await comprobar(colaborador, colaborador, false);

        await client.query(
          "UPDATE obra.usuarios SET estado = 'ACTIVO' WHERE id_usuario = $1",
          [colaborador],
        );

        await comprobar(colaborador, segundoColaborador, true);

        // Retirar la colaboración revoca el acceso compartido.
        await client.query(
          `
            DELETE FROM obra.usuario_proyecto
            WHERE id_usuario = $1 AND id_proyecto = $2
          `,
          [segundoColaborador, proyecto],
        );

        await comprobar(colaborador, segundoColaborador, false);
        await comprobar(segundoColaborador, colaborador, false);
        await comprobar(segundoColaborador, segundoColaborador, true);

        // Una cuenta sin fotografía devuelve null aunque exista permiso.
        await client.query(
          `
            UPDATE obra.usuarios
            SET foto_perfil_url = NULL, foto_perfil_key = NULL
            WHERE id_usuario = $1
          `,
          [colaborador],
        );

        await comprobar(colaborador, propietario, false);
        await comprobar(colaborador, colaborador, false);

        throw finalizar;
      }),
      (error) => error === finalizar,
    );
  } finally {
    await database.onApplicationShutdown();
  }
});