require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  ActividadesConsultaRepository,
} = require(
  '../../dist/modules/actividades/actividades-consulta.repository',
);

test(
  'historial: aplica permisos, pagina y conserva actividades de antiguos colaboradores',
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
                'Proyecto temporal de historial',
                'Preparación de prueba',
                'Dirección temporal',
                'Contratante temporal',
                '2026-09-10'::date,
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

          const repositorio = new ActividadesConsultaRepository({
            query: (sql, parametros) => client.query(sql, parametros),
          });

          const consultar = (
            idUsuario = idPropietario,
            pagina = 1,
            limite = 2,
          ) =>
            repositorio.findDisponiblesPaginadas(
              idProyecto,
              idUsuario,
              pagina,
              limite,
            );

          // Un proyecto disponible sin actividades no equivale a un 404.
          assert.deepEqual(await consultar(), {
            actividades: [],
            total: 0,
          });

          /*
           * Insertamos fechas explícitas al preparar los registros.
           * No actualizamos actividades: el historial es inmutable.
           *
           * Dos fechas iguales permiten comprobar el desempate por UUID.
           */
          const idsEmpatados = [randomUUID(), randomUUID()].sort();

          const registros = [
            {
              id: randomUUID(),
              actor: idPropietario,
              fecha: '2026-09-10T10:00:00.000Z',
            },
            {
              id: idsEmpatados[0],
              actor: idColaborador,
              fecha: '2026-09-10T11:00:00.000Z',
            },
            {
              id: idsEmpatados[1],
              actor: idColaborador,
              fecha: '2026-09-10T11:00:00.000Z',
            },
          ];

          for (const registro of registros) {
            await client.query(
              `
                INSERT INTO obra.actividades (
                  id_actividad,
                  id_proyecto,
                  id_actor,
                  tipo_accion,
                  mensaje,
                  fecha_creacion
                )
                VALUES (
                  $1::uuid,
                  $2::uuid,
                  $3::uuid,
                  'FOTOGRAFIA_SUBIDA',
                  'Actividad preparada para probar la consulta.',
                  $4::timestamptz
                )
              `,
              [
                registro.id,
                idProyecto,
                registro.actor,
                registro.fecha,
              ],
            );
          }

          // Registros históricos de prueba, sin una subida física asociada.
          const primeraPagina = await consultar();

          assert.ok(primeraPagina);
          assert.equal(primeraPagina.total, 3);
          assert.deepEqual(
            primeraPagina.actividades.map((actividad) =>
              actividad.id_actividad),
            [idsEmpatados[1], idsEmpatados[0]],
          );

          assert.ok(
            primeraPagina.actividades[0].fecha_creacion instanceof Date,
          );
          assert.equal(
            primeraPagina.actividades[0].fecha_creacion.toISOString(),
            '2026-09-10T11:00:00.000Z',
          );

          const segundaPagina = await consultar(idPropietario, 2);

          assert.ok(segundaPagina);
          assert.equal(segundaPagina.total, 3);
          assert.deepEqual(
            segundaPagina.actividades.map((actividad) =>
              actividad.id_actividad),
            [registros[0].id],
          );

          assert.deepEqual(
            await consultar(idPropietario, 3),
            { actividades: [], total: 3 },
          );

          // El colaborador activo consulta el mismo historial.
          assert.deepEqual(
            await consultar(idColaborador),
            primeraPagina,
          );

          // El rol global no concede acceso a un proyecto ajeno.
          assert.equal(await consultar(idAdministrador), null);
          assert.equal(await consultar(randomUUID()), null);

          assert.equal(
            await repositorio.findDisponiblesPaginadas(
              randomUUID(),
              idPropietario,
              1,
              2,
            ),
            null,
          );

          // La cuenta inactiva pierde acceso, pero su historial permanece.
          await client.query(
            `
              UPDATE obra.usuarios
              SET estado = 'INACTIVO'::obra.estado_usuario
              WHERE id_usuario = $1::uuid
            `,
            [idColaborador],
          );

          assert.equal(await consultar(idColaborador), null);
          assert.deepEqual(await consultar(), primeraPagina);

          await client.query(
            `
              UPDATE obra.usuarios
              SET estado = 'ACTIVO'::obra.estado_usuario
              WHERE id_usuario = $1::uuid
            `,
            [idColaborador],
          );

          assert.deepEqual(
            await consultar(idColaborador),
            primeraPagina,
          );

          // Retirar la relación tampoco elimina las actividades del actor.
          await client.query(
            `
              DELETE FROM obra.usuario_proyecto
              WHERE id_usuario = $1::uuid
                AND id_proyecto = $2::uuid
            `,
            [idColaborador, idProyecto],
          );

          assert.equal(await consultar(idColaborador), null);
          assert.deepEqual(await consultar(), primeraPagina);

          // El estado de trabajo no equivale a eliminación lógica.
          for (const estado of ['PAUSA', 'FINALIZADA']) {
            await client.query(
              `
                UPDATE obra.proyectos
                SET estado_proyecto = $2::obra.estado_proyecto
                WHERE id_proyecto = $1::uuid
              `,
              [idProyecto, estado],
            );

            assert.deepEqual(await consultar(), primeraPagina);
          }

          await client.query(
            `
              UPDATE obra.proyectos
              SET activo = false
              WHERE id_proyecto = $1::uuid
            `,
            [idProyecto],
          );

          assert.equal(await consultar(), null);

          await client.query(
            `
              UPDATE obra.proyectos
              SET activo = true
              WHERE id_proyecto = $1::uuid
            `,
            [idProyecto],
          );

          // Conservamos un colaborador activo para comprobar el bloqueo
          // causado específicamente por la inactivación del propietario.
          await client.query(
            `
              INSERT INTO obra.usuario_proyecto (
                id_usuario, id_proyecto
              )
              VALUES ($1::uuid, $2::uuid)
            `,
            [idColaborador, idProyecto],
          );

          await client.query(
            `
              UPDATE obra.usuarios
              SET estado = 'INACTIVO'::obra.estado_usuario
              WHERE id_usuario = $1::uuid
            `,
            [idPropietario],
          );

          assert.equal(await consultar(), null);
          assert.equal(await consultar(idColaborador), null);

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
            primeraPagina,
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