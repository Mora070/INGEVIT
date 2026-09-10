require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  FotografiasConsultaRepository,
} = require(
  '../../dist/modules/fotografias/fotografias-consulta.repository',
);

test(
  'fotografías: pagina, aísla proyectos y comprueba el acceso sin perder la autoría',
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

          async function crearProyecto(idPropietario) {
            const id = randomUUID();

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
                  'Proyecto temporal de fotografías',
                  'Preparación de prueba',
                  'Dirección temporal',
                  'Contratante temporal',
                  '2026-09-10'::date,
                  'ACTIVA'::obra.estado_proyecto
                )
              `,
              [id, idPropietario],
            );

            return id;
          }

          /**
           * Prepara únicamente metadatos.
           * No crea archivos locales ni objetos en Amazon S3.
           */
          async function insertarFotografia(
            id,
            idProyecto,
            idUsuario,
            fecha,
          ) {
            await client.query(
              `
                INSERT INTO obra.fotografias (
                  id_fotografia,
                  id_proyecto,
                  id_usuario_subida,
                  titulo,
                  url,
                  s3_key,
                  fecha_subida
                )
                VALUES (
                  $1::uuid,
                  $2::uuid,
                  $3::uuid,
                  'Fotografía de prueba',
                  $4,
                  $5,
                  $6::timestamptz
                )
              `,
              [
                id,
                idProyecto,
                idUsuario,
                `https://example.invalid/${id}.jpg`,
                `fotografias/${id}.jpg`,
                fecha,
              ],
            );
          }

          const idPropietario = await crearUsuario();
          const idColaborador = await crearUsuario();
          const idAdministrador = await crearUsuario('ADMINISTRADOR');
          const idProyecto = await crearProyecto(idPropietario);
          const idProyectoAjeno = await crearProyecto(idAdministrador);

          await client.query(
            `
              INSERT INTO obra.usuario_proyecto (
                id_usuario, id_proyecto
              )
              VALUES ($1::uuid, $2::uuid)
            `,
            [idColaborador, idProyecto],
          );

          const repositorio = new FotografiasConsultaRepository({
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

          assert.deepEqual(await consultar(), {
            fotografias: [],
            total: 0,
          });

          const idAntigua = randomUUID();
          const idsEmpatados = [randomUUID(), randomUUID()].sort();
          const idFotografiaAjena = randomUUID();

          await insertarFotografia(
            idAntigua,
            idProyecto,
            idPropietario,
            '2026-09-10T10:00:00.000Z',
          );

          for (const id of idsEmpatados) {
            await insertarFotografia(
              id,
              idProyecto,
              idColaborador,
              '2026-09-10T11:00:00.000Z',
            );
          }

          // Esta fotografía no debe aparecer ni sumarse al total.
          await insertarFotografia(
            idFotografiaAjena,
            idProyectoAjeno,
            idAdministrador,
            '2026-09-10T12:00:00.000Z',
          );

          const primeraPagina = await consultar();

          assert.ok(primeraPagina);
          assert.equal(primeraPagina.total, 3);
          assert.deepEqual(
            primeraPagina.fotografias.map((foto) => foto.id_fotografia),
            [idsEmpatados[1], idsEmpatados[0]],
          );

          for (const foto of primeraPagina.fotografias) {
            assert.equal(foto.id_proyecto, idProyecto);
            assert.equal(foto.id_usuario_subida, idColaborador);
            assert.equal(
              foto.s3_key,
              `fotografias/${foto.id_fotografia}.jpg`,
            );
            assert.ok(foto.fecha_subida instanceof Date);
            assert.equal(
              foto.fecha_subida.toISOString(),
              '2026-09-10T11:00:00.000Z',
            );
          }

          const segundaPagina = await consultar(idPropietario, 2);

          assert.ok(segundaPagina);
          assert.equal(segundaPagina.total, 3);
          assert.deepEqual(
            segundaPagina.fotografias.map((foto) => foto.id_fotografia),
            [idAntigua],
          );

          assert.deepEqual(
            await consultar(idPropietario, 3),
            { fotografias: [], total: 3 },
          );

          assert.deepEqual(
            await consultar(idColaborador),
            primeraPagina,
          );

          // Ser administrador global no concede acceso a este proyecto.
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

          // Inactivar al autor bloquea su acceso, no sus fotografías.
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

          // Retirar la colaboración conserva las fotografías y su autoría.
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

          // Restablecemos al colaborador para comprobar el bloqueo
          // provocado específicamente por la inactivación del propietario.
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