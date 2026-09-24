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

/**
 * Ejecuta el UPDATE real dentro de una transacción que se revierte.
 * No crea archivos ni conserva datos al finalizar.
 */
test(
  'actualizarTitulo: modifica solo el título y exige el proyecto correcto',
  async () => {
    const database = new DatabaseService();
    const finalizar = new Error('Revertir datos de la prueba');

    try {
      await database.onModuleInit();

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
                  'Prueba de actualización del título',
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
              titulo: 'Título anterior',
              url: '/fotografia-temporal.webp',
              s3Key: `fotografias/${randomUUID()}.webp`,
              originalS3Key: `fotografias/${randomUUID()}.jpeg`,
            });

            /*
             * El segundo proyecto existe, pero no contiene la foto.
             * Conocer su identificador no debe permitir actualizarla
             * utilizando un proyecto diferente.
             */
            const ajena = await repositorio.actualizarTitulo(
              client,
              idOtroProyecto,
              original.id_fotografia,
              'Cambio no permitido',
            );

            assert.equal(ajena, null);

            const consultar = async () => {
              const resultado = await client.query(
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

              assert.equal(resultado.rowCount, 1);
              return resultado.rows[0];
            };

            assert.deepEqual(await consultar(), original);

            const tituloNuevo = 'Avance actualizado — sector norte';

            const actualizada = await repositorio.actualizarTitulo(
              client,
              idProyecto,
              original.id_fotografia,
              tituloNuevo,
            );

            /*
             * La comparación completa verifica que se conservan:
             * autor, proyecto, fecha, URL y ambas claves.
             */
            const esperado = {
              ...original,
              titulo: tituloNuevo,
            };

            assert.deepEqual(actualizada, esperado);
            assert.deepEqual(await consultar(), esperado);

            // Una fotografía inexistente tampoco produce cambios.
            const inexistente = await repositorio.actualizarTitulo(
              client,
              idProyecto,
              randomUUID(),
              'Otro título',
            );

            assert.equal(inexistente, null);
            assert.deepEqual(await consultar(), esperado);

            throw finalizar;
          }),
        (error) => {
          // Un fallo de aserción no se confunde con el cierre esperado.
          assert.strictEqual(error, finalizar);
          return true;
        },
      );
    } finally {
      await database.onApplicationShutdown();
    }
  },
);