require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  FotografiasRepository,
} = require('../../dist/modules/fotografias/fotografias.repository');

test(
  'eliminar fotografía: exige el proyecto correcto y permite restaurar el registro con rollback',
  async () => {
    const database = new DatabaseService();
    const finalizar = new Error('Revertir datos de integración');
    let conexionInicializada = false;

    try {
      await database.onModuleInit();
      conexionInicializada = true;

      await assert.rejects(
        () =>
          database.withTransaction(async (client) => {
            const idUsuario = randomUUID();
            const idProyecto = randomUUID();
            const idOtroProyecto = randomUUID();

            await client.query(
              `
                INSERT INTO obra.usuarios (
                  id_usuario, correo, google_sub
                )
                VALUES ($1, $2, $3)
              `,
              [
                idUsuario,
                `${idUsuario}@example.invalid`,
                `integracion-${idUsuario}`,
              ],
            );

            for (const id of [idProyecto, idOtroProyecto]) {
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
                  id,
                  idUsuario,
                  'Proyecto temporal',
                  'Prueba de eliminación de fotografía',
                  'Dirección temporal',
                  'Contratante temporal',
                  '2026-09-14',
                  'ACTIVA',
                ],
              );
            }

            const repositorio = new FotografiasRepository();

            const original = await repositorio.crear(client, {
              idProyecto,
              idUsuarioSubida: idUsuario,
              titulo: 'Fotografía temporal',
              url: '/fotografia-temporal.webp',
              s3Key: `fotografias/${randomUUID()}.webp`,
              originalS3Key: `fotografias/${randomUUID()}.jpeg`,
            });

            const consultar = () =>
              client.query(
                `
                  SELECT
                    id_fotografia,
                    id_proyecto,
                    id_usuario_subida,
                    titulo,
                    url,
                    s3_key,
                    original_s3_key,
                    latitud,
                    longitud,
                    fecha_subida
                  FROM obra.fotografias
                  WHERE id_fotografia = $1
                `,
                [original.id_fotografia],
              );

            // Otro proyecto existente no permite eliminar esta fotografía.
            const ajena = await repositorio.eliminar(
              client,
              idOtroProyecto,
              original.id_fotografia,
            );

            assert.equal(ajena, null);
            assert.deepEqual((await consultar()).rows, [original]);

            /*
             * El punto de guardado se establece después de crear
             * la fotografía, para poder restaurarla tras el DELETE.
             */
            await client.query('SAVEPOINT antes_de_eliminar');

            const eliminada = await repositorio.eliminar(
              client,
              idProyecto,
              original.id_fotografia,
            );

            // RETURNING debe conservar ambas claves y el resto de datos.
            assert.deepEqual(eliminada, original);
            assert.equal((await consultar()).rowCount, 0);

            // Repetir el DELETE devuelve ausencia.
            const repetida = await repositorio.eliminar(
              client,
              idProyecto,
              original.id_fotografia,
            );

            assert.equal(repetida, null);

            await client.query(
              'ROLLBACK TO SAVEPOINT antes_de_eliminar',
            );
            await client.query(
              'RELEASE SAVEPOINT antes_de_eliminar',
            );

            // La reversión restaura todos los campos del registro.
            const restaurada = await consultar();

            assert.equal(restaurada.rowCount, 1);
            assert.deepEqual(restaurada.rows[0], original);

            // Revierte también usuarios, proyectos y fotografía temporal.
            throw finalizar;
          }),
        (error) => {
          assert.strictEqual(error, finalizar);
          return true;
        },
      );
    } finally {
      if (conexionInicializada) {
        await database.onApplicationShutdown();
      }
    }
  },
);