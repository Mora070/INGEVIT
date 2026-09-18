require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  ProyectosRepository,
} = require('../../dist/modules/proyectos/proyectos.repository');

test(
  'findParticipantesDisponibles: aplica acceso y devuelve participantes sin duplicar al propietario',
  async () => {
    const database = new DatabaseService();
    const rollbackDeLimpieza = new Error(
      'Revertir los datos temporales de la prueba.',
    );

    try {
      await assert.rejects(
        database.withTransaction(async (client) => {
          /**
           * Crea cuentas temporales dentro de la transacción.
           * Los perfiles incompletos permiten comprobar los campos nulos.
           */
          async function crearUsuario({
            rol = 'USUARIO',
            estado = 'ACTIVO',
          } = {}) {
            const idUsuario = randomUUID();

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
                  $4::obra.rol_usuario,
                  $5::obra.estado_usuario
                )
              `,
              [
                idUsuario,
                `integracion-${idUsuario}@example.invalid`,
                `google-integracion-${idUsuario}`,
                rol,
                estado,
              ],
            );

            return idUsuario;
          }

          const idPropietario = await crearUsuario();
          const idColaborador = await crearUsuario();
          const idColaboradorInactivo = await crearUsuario({
            estado: 'INACTIVO',
          });
          const idAjeno = await crearUsuario();
          const idAdministrador = await crearUsuario({
            rol: 'ADMINISTRADOR',
          });
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
                $3,
                $4,
                $5,
                $6,
                $7::date,
                'ACTIVA'::obra.estado_proyecto
              )
            `,
            [
              idProyecto,
              idPropietario,
              'Proyecto temporal de participantes',
              'Datos de preparación de la prueba.',
              'Dirección temporal',
              'Contratante temporal',
              '2026-09-10',
            ],
          );

          const repositorio = new ProyectosRepository({
            query: (sql, parametros) => client.query(sql, parametros),
          });

          const consultar = (idUsuario) =>
            repositorio.findParticipantesDisponibles(
              idProyecto,
              idUsuario,
            );

          const propietarioEsperado = {
            id_usuario: idPropietario,
            nombre: null,
            apellidos: null,
            foto_perfil_url: null,
            participacion: 'PROPIETARIO',
          };

          // Un proyecto sin colaboradores sigue mostrando a su propietario.
          assert.deepEqual(await consultar(idPropietario), [
            propietarioEsperado,
          ]);

          /*
           * Incluimos deliberadamente al propietario en la relación.
           * Debe seguir apareciendo una sola vez como PROPIETARIO.
           */
          for (const idUsuario of [
            idPropietario,
            idColaborador,
            idColaboradorInactivo,
          ]) {
            await client.query(
              `
                INSERT INTO obra.usuario_proyecto (
                  id_usuario,
                  id_proyecto
                )
                VALUES ($1::uuid, $2::uuid)
              `,
              [idUsuario, idProyecto],
            );
          }

          const participantes = await consultar(idPropietario);

          assert.equal(participantes.length, 3);
          assert.deepEqual(participantes[0], propietarioEsperado);

          assert.equal(
            participantes.filter(
              (usuario) => usuario.id_usuario === idPropietario,
            ).length,
            1,
          );

          // Con nombres nulos, el identificador resuelve el orden.
          const idsColaboradores = [
            idColaborador,
            idColaboradorInactivo,
          ].sort();

          assert.deepEqual(
            participantes.slice(1),
            idsColaboradores.map((idUsuario) => ({
              id_usuario: idUsuario,
              nombre: null,
              apellidos: null,
              foto_perfil_url: null,
              participacion: 'COLABORADOR',
            })),
          );

          // Un colaborador activo puede consultar los mismos participantes.
          assert.deepEqual(
            await consultar(idColaborador),
            participantes,
          );

          // El colaborador inactivo aparece, pero no puede consultar.
          assert.deepEqual(
            await consultar(idColaboradorInactivo),
            [],
          );

          // El rol global de administrador no concede acceso por sí solo.
          for (const idUsuario of [
            idAjeno,
            idAdministrador,
            randomUUID(),
          ]) {
            assert.deepEqual(await consultar(idUsuario), []);
          }

          assert.deepEqual(
            await repositorio.findParticipantesDisponibles(
              randomUUID(),
              idPropietario,
            ),
            [],
          );

          // PAUSA y FINALIZADA no equivalen a eliminación lógica.
          for (const estado of ['PAUSA', 'FINALIZADA']) {
            await client.query(
              `
                UPDATE obra.proyectos
                SET estado_proyecto = $2::obra.estado_proyecto
                WHERE id_proyecto = $1::uuid
              `,
              [idProyecto, estado],
            );

            assert.deepEqual(
              await consultar(idColaborador),
              participantes,
            );
          }

          // La eliminación lógica bloquea la consulta.
          await client.query(
            `
              UPDATE obra.proyectos
              SET activo = false
              WHERE id_proyecto = $1::uuid
            `,
            [idProyecto],
          );

          assert.deepEqual(await consultar(idPropietario), []);
          assert.deepEqual(await consultar(idColaborador), []);

          await client.query(
            `
              UPDATE obra.proyectos
              SET activo = true
              WHERE id_proyecto = $1::uuid
            `,
            [idProyecto],
          );

          // Inactivar al propietario bloquea a todos los participantes.
          await client.query(
            `
              UPDATE obra.usuarios
              SET estado = 'INACTIVO'::obra.estado_usuario
              WHERE id_usuario = $1::uuid
            `,
            [idPropietario],
          );

          assert.deepEqual(await consultar(idPropietario), []);
          assert.deepEqual(await consultar(idColaborador), []);

          // Reactivarlo recupera la disponibilidad.
          await client.query(
            `
              UPDATE obra.usuarios
              SET estado = 'ACTIVO'::obra.estado_usuario
              WHERE id_usuario = $1::uuid
            `,
            [idPropietario],
          );

          assert.deepEqual(
            await consultar(idColaborador),
            participantes,
          );

          // Reactivar al colaborador recupera su acceso sin agregarlo otra vez.
          await client.query(
            `
              UPDATE obra.usuarios
              SET estado = 'ACTIVO'::obra.estado_usuario
              WHERE id_usuario = $1::uuid
            `,
            [idColaboradorInactivo],
          );

          assert.deepEqual(
            await consultar(idColaboradorInactivo),
            participantes,
          );

          throw rollbackDeLimpieza;
        }),
        (error) => error === rollbackDeLimpieza,
      );
    } finally {
      await database.onApplicationShutdown();
    }
  },
);