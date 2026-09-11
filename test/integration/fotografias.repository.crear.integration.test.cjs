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
  'FotografiasRepository.crear: inserta ambas referencias y recupera los valores generados por PostgreSQL',
  async () => {
    const database = new DatabaseService();
    const rollbackDeLimpieza = new Error(
      'Revertir los datos temporales de la prueba.',
    );

    try {
      await assert.rejects(
        database.withTransaction(async (client) => {
          async function crearUsuario() {
            const id = randomUUID();

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
                  'USUARIO'::obra.rol_usuario,
                  'ACTIVO'::obra.estado_usuario
                )
              `,
              [
                id,
                `integracion-${id}@example.invalid`,
                `google-integracion-${id}`,
              ],
            );

            return id;
          }

          const idPropietario = await crearUsuario();
          const idColaborador = await crearUsuario();
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
                'Proyecto temporal de inserción',
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
                id_usuario,
                id_proyecto
              )
              VALUES ($1::uuid, $2::uuid)
            `,
            [idColaborador, idProyecto],
          );

          const datos = {
            idProyecto,
            idUsuarioSubida: idColaborador,
            titulo: 'Avance de obra — fotografía de prueba',
            url: `https://example.invalid/${randomUUID()}.webp`,
            s3Key: `fotografias/${randomUUID()}.webp`,
            originalS3Key: `fotografias/${randomUUID()}.jpeg`,
          };

          /*
           * CURRENT_TIMESTAMP corresponde al inicio de la transacción.
           * Obtenemos el valor desde PostgreSQL para no depender del reloj
           * del equipo ni del tiempo que tarde la prueba.
           */
          const fechaTransaccion = await client.query(
            'SELECT CURRENT_TIMESTAMP AS fecha',
          );

          const repositorio = new FotografiasRepository();

          const fotografia = await repositorio.crear(client, datos);

          assert.match(
            fotografia.id_fotografia,
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          );

          assert.ok(fotografia.fecha_subida instanceof Date);
          assert.equal(
            fotografia.fecha_subida.getTime(),
            fechaTransaccion.rows[0].fecha.getTime(),
          );

          assert.equal(fotografia.id_proyecto, idProyecto);
          assert.equal(
            fotografia.id_usuario_subida,
            idColaborador,
          );
          assert.equal(fotografia.titulo, datos.titulo);
          assert.equal(fotografia.url, datos.url);
          assert.equal(fotografia.s3_key, datos.s3Key);
          assert.equal(
            fotografia.original_s3_key,
            datos.originalS3Key,
          );

          // Verificamos lo almacenado, además del resultado de RETURNING.
          const consulta = await client.query(
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
              WHERE id_fotografia = $1::uuid
            `,
            [fotografia.id_fotografia],
          );

          assert.equal(consulta.rowCount, 1);
          assert.deepEqual(consulta.rows[0], fotografia);

          /*
           * El repositorio recibe un cliente externo y no debe confirmar
           * su transacción. La señal final revierte también esta inserción.
           */
          throw rollbackDeLimpieza;
        }),
        (error) => error === rollbackDeLimpieza,
      );
    } finally {
      await database.onApplicationShutdown();
    }
  },
);