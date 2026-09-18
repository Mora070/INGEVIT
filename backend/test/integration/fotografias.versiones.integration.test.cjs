require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

test(
  'fotografías: exige un original único y distinto de la versión optimizada',
  async () => {
    const database = new DatabaseService();
    const rollbackDeLimpieza = new Error(
      'Revertir los datos temporales de la prueba.',
    );

    try {
      await assert.rejects(
        database.withTransaction(async (client) => {
          const idUsuario = randomUUID();
          const idProyecto = randomUUID();
          const idFotografia = randomUUID();

          await client.query(
            `
              INSERT INTO obra.usuarios (
                id_usuario, correo, google_sub, rol, estado
              )
              VALUES (
                $1::uuid,
                $2,
                $3,
                'USUARIO'::obra.rol_usuario,
                'ACTIVO'::obra.estado_usuario
              )
            `,
            [
              idUsuario,
              `integracion-${idUsuario}@example.invalid`,
              `google-integracion-${idUsuario}`,
            ],
          );

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
                'Proyecto temporal de versiones',
                'Preparación de prueba',
                'Dirección temporal',
                'Contratante temporal',
                '2026-09-11'::date,
                'ACTIVA'::obra.estado_proyecto
              )
            `,
            [idProyecto, idUsuario],
          );

          /**
           * Inserta únicamente metadatos.
           * No crea archivos físicos ni ejecuta procesamiento de imágenes.
           */
          async function insertarFotografia(
            id,
            claveOptimizada,
            claveOriginal,
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
                  original_s3_key
                )
                VALUES (
                  $1::uuid,
                  $2::uuid,
                  $3::uuid,
                  'Fotografía de prueba',
                  $4,
                  $5,
                  $6
                )
              `,
              [
                id,
                idProyecto,
                idUsuario,
                `https://example.invalid/${id}.jpg`,
                claveOptimizada,
                claveOriginal,
              ],
            );
          }

          const claveOptimizada = `fotografias/${randomUUID()}.jpg`;
          const claveOriginal = `fotografias/${randomUUID()}.jpg`;

          await insertarFotografia(
            idFotografia,
            claveOptimizada,
            claveOriginal,
          );

          async function consultarFotografias() {
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
                  fecha_subida
                FROM obra.fotografias
                WHERE id_proyecto = $1::uuid
                ORDER BY id_fotografia
              `,
              [idProyecto],
            );

            return resultado.rows;
          }

          const registrosOriginales = await consultarFotografias();

          assert.equal(registrosOriginales.length, 1);
          assert.equal(
            registrosOriginales[0].s3_key,
            claveOptimizada,
          );
          assert.equal(
            registrosOriginales[0].original_s3_key,
            claveOriginal,
          );

          /**
           * Recupera la transacción después de cada rechazo esperado.
           * También revierte la inserción si llegara a aceptarse por error.
           */
          async function comprobarRechazo(
            operacion,
            codigo,
            restriccion,
            columna,
          ) {
            await client.query('SAVEPOINT validar_versiones');

            try {
              await assert.rejects(
                operacion(),
                (error) => {
                  assert.equal(error.code, codigo);

                  if (restriccion) {
                    assert.equal(error.constraint, restriccion);
                  }

                  if (columna) {
                    assert.equal(error.column, columna);
                  }

                  return true;
                },
              );
            } finally {
              await client.query(
                'ROLLBACK TO SAVEPOINT validar_versiones',
              );
              await client.query(
                'RELEASE SAVEPOINT validar_versiones',
              );
            }

            assert.deepEqual(
              await consultarFotografias(),
              registrosOriginales,
            );
          }

          // La referencia al original es obligatoria.
          await comprobarRechazo(
            () =>
              insertarFotografia(
                randomUUID(),
                `fotografias/${randomUUID()}.jpg`,
                null,
              ),
            '23502',
            undefined,
            'original_s3_key',
          );

          // Dos fotografías no pueden compartir original_s3_key.
          await comprobarRechazo(
            () =>
              insertarFotografia(
                randomUUID(),
                `fotografias/${randomUUID()}.jpg`,
                claveOriginal,
              ),
            '23505',
            'fotografias_original_s3_key_unique',
          );

          // Ambas versiones deben tener claves diferentes en la misma fila.
          const claveRepetida = `fotografias/${randomUUID()}.jpg`;

          await comprobarRechazo(
            () =>
              insertarFotografia(
                randomUUID(),
                claveRepetida,
                claveRepetida,
              ),
            '23514',
            'fotografias_claves_distintas_check',
          );

          // El original debe pertenecer al prefijo de fotografías.
          await comprobarRechazo(
            () =>
              insertarFotografia(
                randomUUID(),
                `fotografias/${randomUUID()}.jpg`,
                `planos/${randomUUID()}.pdf`,
              ),
            '23514',
            'fotografias_original_s3_key_check',
          );

          // El prefijo por sí solo no identifica un archivo.
          await comprobarRechazo(
            () =>
              insertarFotografia(
                randomUUID(),
                `fotografias/${randomUUID()}.jpg`,
                'fotografias/',
              ),
            '23514',
            'fotografias_original_s3_key_check',
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