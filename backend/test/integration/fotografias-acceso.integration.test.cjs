require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  FotografiasAccesoRepository,
} = require(
  '../../dist/modules/fotografias/fotografias-acceso.repository',
);

test(
  'fotografías: permite al propietario y colaboradores activos y rechaza accesos no disponibles',
  async () => {
    const database = new DatabaseService();
    const rollbackDeLimpieza = new Error(
      'Revertir los datos temporales de la prueba.',
    );

    try {
      await assert.rejects(
        database.withTransaction(async (client) => {
          async function crearUsuario(rol = 'USUARIO') {
            const id = randomUUID();

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
                  'ACTIVO'::obra.estado_usuario
                )
              `,
              [
                id,
                `integracion-${id}@example.invalid`,
                `google-integracion-${id}`,
                rol,
              ],
            );

            return id;
          }

          const idPropietario = await crearUsuario();
          const idColaborador = await crearUsuario();
          const idAjeno = await crearUsuario();
          const idAdministrador = await crearUsuario('ADMINISTRADOR');
          const idProyecto = randomUUID();

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
              VALUES (
                $1::uuid,
                $2::uuid,
                'Proyecto temporal de acceso',
                'Preparación de prueba',
                'Dirección temporal',
                'Contratante temporal',
                '2026-09-11'::date,
                'ACTIVA'::obra.estado_proyecto
              )
            `,
            [idProyecto, idPropietario],
          );

          await client.query(
            `
              INSERT INTO obra.usuario_proyecto (
                id_usuario, id_proyecto
              )
              VALUES ($1::uuid, $2::uuid)
            `,
            [idColaborador, idProyecto],
          );

          const repositorio = new FotografiasAccesoRepository();

          const comprobarAcceso = (idUsuario) =>
            repositorio.bloquearDisponible(
              client,
              idProyecto,
              idUsuario,
            );

          // El propietario no necesita una relación de colaboración.
          assert.equal(await comprobarAcceso(idPropietario), true);
          assert.equal(await comprobarAcceso(idColaborador), true);

          assert.equal(await comprobarAcceso(idAjeno), false);
          assert.equal(await comprobarAcceso(idAdministrador), false);
          assert.equal(await comprobarAcceso(randomUUID()), false);

          assert.equal(
            await repositorio.bloquearDisponible(
              client,
              randomUUID(),
              idPropietario,
            ),
            false,
          );

          // Los estados de trabajo no equivalen a eliminación lógica.
          for (const estado of ['PAUSA', 'FINALIZADA']) {
            await client.query(
              `
                UPDATE obra.proyectos
                SET estado_proyecto = $2::obra.estado_proyecto
                WHERE id_proyecto = $1::uuid
              `,
              [idProyecto, estado],
            );

            assert.equal(await comprobarAcceso(idPropietario), true);
            assert.equal(await comprobarAcceso(idColaborador), true);
          }

          // Inactivar al colaborador bloquea solo su acceso.
          await client.query(
            `
              UPDATE obra.usuarios
              SET estado = 'INACTIVO'::obra.estado_usuario
              WHERE id_usuario = $1::uuid
            `,
            [idColaborador],
          );

          assert.equal(await comprobarAcceso(idColaborador), false);
          assert.equal(await comprobarAcceso(idPropietario), true);

          await client.query(
            `
              UPDATE obra.usuarios
              SET estado = 'ACTIVO'::obra.estado_usuario
              WHERE id_usuario = $1::uuid
            `,
            [idColaborador],
          );

          assert.equal(await comprobarAcceso(idColaborador), true);

          // Inactivar al propietario bloquea el proyecto para ambos.
          await client.query(
            `
              UPDATE obra.usuarios
              SET estado = 'INACTIVO'::obra.estado_usuario
              WHERE id_usuario = $1::uuid
            `,
            [idPropietario],
          );

          assert.equal(await comprobarAcceso(idPropietario), false);
          assert.equal(await comprobarAcceso(idColaborador), false);

          await client.query(
            `
              UPDATE obra.usuarios
              SET estado = 'ACTIVO'::obra.estado_usuario
              WHERE id_usuario = $1::uuid
            `,
            [idPropietario],
          );

          assert.equal(await comprobarAcceso(idColaborador), true);

          // La eliminación lógica impide operar sobre el proyecto.
          await client.query(
            `
              UPDATE obra.proyectos
              SET activo = false
              WHERE id_proyecto = $1::uuid
            `,
            [idProyecto],
          );

          assert.equal(await comprobarAcceso(idPropietario), false);
          assert.equal(await comprobarAcceso(idColaborador), false);

          await client.query(
            `
              UPDATE obra.proyectos
              SET activo = true
              WHERE id_proyecto = $1::uuid
            `,
            [idProyecto],
          );

          // Retirar la relación elimina el acceso del colaborador.
          await client.query(
            `
              DELETE FROM obra.usuario_proyecto
              WHERE id_usuario = $1::uuid
                AND id_proyecto = $2::uuid
            `,
            [idColaborador, idProyecto],
          );

          assert.equal(await comprobarAcceso(idColaborador), false);
          assert.equal(await comprobarAcceso(idPropietario), true);

          throw rollbackDeLimpieza;
        }),
        (error) => error === rollbackDeLimpieza,
      );
    } finally {
      await database.onApplicationShutdown();
    }
  },
);