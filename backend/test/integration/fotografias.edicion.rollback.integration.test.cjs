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

const {
  FotografiasAccesoRepository,
} = require('../../dist/modules/fotografias/fotografias-acceso.repository');

const {
  FotografiasEdicionService,
} = require('../../dist/modules/fotografias/fotografias-edicion.service');

const {
  ActividadesRepository,
} = require('../../dist/modules/actividades/actividades.repository');

test(
  'edición fotografía: revierte el título si falla el registro de actividad',
  async () => {
    const database = new DatabaseService();
    const fotografias = new FotografiasRepository();
    const actividades = new ActividadesRepository();

    const idUsuario = randomUUID();
    const idProyecto = randomUUID();
    const idActorInexistente = randomUUID();

    let conexionInicializada = false;

    try {
      await database.onModuleInit();
      conexionInicializada = true;

      /*
       * Confirmamos la preparación antes de ejecutar el servicio.
       * Así podemos comprobar desde otra transacción que el título
       * anterior permanece después del fallo.
       */
      const original = await database.withTransaction(async (client) => {
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
            idProyecto,
            idUsuario,
            'Proyecto temporal',
            'Prueba de reversión de edición',
            'Dirección temporal',
            'Contratante temporal',
            '2026-09-14',
            'ACTIVA',
          ],
        );

        return fotografias.crear(client, {
          idProyecto,
          idUsuarioSubida: idUsuario,
          titulo: 'Título original',
          url: '/fotografia-temporal.webp',
          s3Key: `fotografias/${randomUUID()}.webp`,
          originalS3Key: `fotografias/${randomUUID()}.jpeg`,
        });
      });

      let tituloObservadoDentroDeTransaccion;

      const servicio = new FotografiasEdicionService(
        database,
        new FotografiasAccesoRepository(),
        fotografias,
        {
          async crear(client, datos) {
            /*
             * Comprobamos que el UPDATE ya ocurrió dentro de la
             * transacción antes de provocar el fallo.
             */
            const resultado = await client.query(
              `
                SELECT titulo
                FROM obra.fotografias
                WHERE id_fotografia = $1
              `,
              [original.id_fotografia],
            );

            tituloObservadoDentroDeTransaccion =
              resultado.rows[0].titulo;

            /*
             * Ejecutamos el INSERT real con un actor inexistente.
             * PostgreSQL lo rechazará por la clave foránea.
             *
             * Esta alteración existe únicamente en la prueba.
             */
            return actividades.crear(client, {
              ...datos,
              idActor: idActorInexistente,
            });
          },
        },
      );

      await assert.rejects(
        () =>
          servicio.actualizarTitulo(
            idProyecto,
            original.id_fotografia,
            idUsuario,
            { titulo: 'Título que debe revertirse' },
          ),
        (error) => {
          assert.equal(error.code, '23503');
          assert.equal(
            error.constraint,
            'actividades_id_actor_fkey',
          );
          return true;
        },
      );

      assert.equal(
        tituloObservadoDentroDeTransaccion,
        'Título que debe revertirse',
      );

      /*
       * Esta consulta ocurre después del ROLLBACK real realizado
       * por DatabaseService, fuera de la transacción fallida.
       */
      const resultadoFinal = await database.query(
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

      assert.equal(resultadoFinal.rowCount, 1);
      assert.deepEqual(resultadoFinal.rows[0], original);

      const historial = await database.query(
        `
          SELECT id_actividad
          FROM obra.actividades
          WHERE id_proyecto = $1
        `,
        [idProyecto],
      );

      assert.equal(historial.rowCount, 0);
    } finally {
      if (conexionInicializada) {
        try {
          // Solo eliminamos los datos identificados por estos UUID.
          await database.withTransaction(async (client) => {
            await client.query(
              'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
              [idProyecto],
            );

            await client.query(
              'DELETE FROM obra.usuarios WHERE id_usuario = $1',
              [idUsuario],
            );
          });
        } finally {
          await database.onApplicationShutdown();
        }
      }
    }
  },
);