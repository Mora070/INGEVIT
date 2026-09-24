require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
    CapasProcesamientoRepository,
} = require('../../dist/modules/capas/capas-procesamiento.repository');

/**
 * Comprueba las restricciones de capas usando PostgreSQL real.
 *
 * Todos los registros se revierten al finalizar.
 * Los identificadores de Mapbox son ficticios: no hay llamadas externas.
 * No genera archivos ni realiza llamadas a Mapbox.
 */
test('capas: valida almacenamiento, ubicación, procesamiento y presentación', async () => {
  const database = new DatabaseService();
  const finalizar = new Error('Reversión deliberada');

  await database.onModuleInit();

  try {
    await assert.rejects(
      database.withTransaction(async (client) => {
        const usuario = randomUUID();
        const proyecto = randomUUID();
        const clave = `capas/${randomUUID()}.tif`;

        await client.query(
          `
            INSERT INTO obra.usuarios (id_usuario, correo, google_sub)
            VALUES ($1, $2, $3)
          `,
          [usuario, `${usuario}@example.invalid`, `capas-${usuario}`],
        );

        await client.query(
          `
            INSERT INTO obra.proyectos (
              id_proyecto, id_propietario, nombre, descripcion,
              direccion, contratante, fecha_inicio, estado_proyecto
            )
            VALUES (
              $1, $2, 'Proyecto de capas', 'Prueba de esquema',
              'Dirección temporal', 'Contratante temporal',
              '2026-09-22', 'ACTIVA'
            )
          `,
          [proyecto, usuario],
        );

        async function insertar(originalKey = clave, idProyecto = proyecto) {
          return client.query(
            `
              INSERT INTO obra.capas (
                id_proyecto, id_usuario_subida, nombre,
                nombre_archivo_original, original_key,
                tamano_original_bytes
              )
              VALUES ($1, $2, 'Ortofoto', 'levantamiento.tif', $3, 1024)
              RETURNING *
            `,
            [idProyecto, usuario, originalKey],
          );
        }

        const creada = (await insertar()).rows[0];
        const idCapa = creada.id_capa;

        assert.equal(creada.almacenamiento_proveedor, 'LOCAL');
        assert.equal(creada.estado_procesamiento, 'PENDIENTE');
        assert.equal(creada.tamano_original_bytes, '1024');
        assert.equal(Number(creada.opacidad), 1);
        assert.equal(creada.visible, true);
        assert.equal(creada.orden, 0);
        assert.equal(creada.descripcion, '');
        assert.ok(creada.fecha_creacion instanceof Date);

        for (const campo of [
          'crs_original',
          'bbox_oeste', 'bbox_sur', 'bbox_este', 'bbox_norte',
          'mapbox_source_id', 'mapbox_tileset_id', 'mapbox_job_id',
          'error_procesamiento',
          'teselas_version',
          'teselas_proveedor',
          'teselas_zoom_min',
          'teselas_zoom_max',
          'teselas_tamano',
          'teselas_total',
          'procesamiento_token',
          'procesamiento_inicio',
        ]) {
          assert.equal(creada[campo], null);
        }

        /**
         * Cada error SQL se aísla mediante un savepoint.
         * También revierte una operación aceptada inesperadamente.
         */
        async function rechazar(operacion, codigo = '23514') {
          await client.query('SAVEPOINT caso_invalido');
          let fallo;

          try {
            await operacion();
          } catch (error) {
            fallo = error;
          } finally {
            await client.query('ROLLBACK TO SAVEPOINT caso_invalido');
            await client.query('RELEASE SAVEPOINT caso_invalido');
          }

          assert.ok(fallo, 'PostgreSQL debía rechazar la operación');
          assert.equal(fallo.code, codigo);
        }

        // Los fragmentos SQL siguientes son constantes de la prueba,
        // nunca entradas de un usuario.
        for (const asignacion of [
          "nombre = '   '",
          "nombre_archivo_original = ''",
          "almacenamiento_proveedor = 'OTRO'",
          "original_key = '../archivo.tif'",
          'tamano_original_bytes = 0',
          "crs_original = ''",
          'bbox_oeste = -74',
          `bbox_oeste = -74, bbox_sur = 4,
           bbox_este = -75, bbox_norte = 5`,
          `bbox_oeste = -74, bbox_sur = 4,
           bbox_este = -73, bbox_norte = 91`,
          "opacidad = 'NaN'::numeric",
          'opacidad = -0.1',
          'opacidad = 1.1',
          'orden = -1',
          "estado_procesamiento = 'DESCONOCIDO'",
          "estado_procesamiento = 'LISTA'",
          "estado_procesamiento = 'ERROR'",
          "error_procesamiento = 'Error sin estado ERROR'",
          "mapbox_source_id = ''",
          "mapbox_tileset_id = ''",
          "mapbox_job_id = ''",
          "fecha_actualizacion = fecha_creacion - INTERVAL '1 second'",
        ]) {
          await rechazar(() => client.query(
            `UPDATE obra.capas SET ${asignacion} WHERE id_capa = $1`,
            [idCapa],
          ));
        }

        // No permite reutilizar una clave ni asociar una capa a un proyecto inexistente.
        await rechazar(() => insertar(), '23505');
        await rechazar(
          () => insertar(`capas/${randomUUID()}.tiff`, randomUUID()),
          '23503',
        );

        // Un error de procesamiento requiere un mensaje.
        await client.query(
          `
            UPDATE obra.capas
            SET estado_procesamiento = 'ERROR',
                error_procesamiento = 'Archivo no procesable'
            WHERE id_capa = $1
          `,
          [idCapa],
        );

                const procesamiento = new CapasProcesamientoRepository();

        /*
         * Preparación exclusiva de la prueba.
         * La recuperación/reintento de trabajos se implementará por separado.
         */
        async function prepararPendiente() {
          await client.query(
            `
              UPDATE obra.capas
              SET estado_procesamiento = 'PENDIENTE',
                  error_procesamiento = NULL,
                  procesamiento_token = NULL,
                  procesamiento_inicio = NULL
              WHERE id_capa = $1
            `,
            [idCapa],
          );
        }

        await prepararPendiente();

        const primerIntento = await procesamiento.iniciar(
          client, proyecto, idCapa,
        );

        assert.ok(primerIntento);
        assert.equal(primerIntento.estado_procesamiento, 'PROCESANDO');
        assert.ok(primerIntento.procesamiento_token);
        assert.ok(primerIntento.procesamiento_inicio instanceof Date);

        // Una capa ya tomada no puede iniciarse de nuevo.
        assert.equal(
          await procesamiento.iniciar(client, proyecto, idCapa),
          null,
        );

        // Un identificador ajeno no puede registrar el fallo.
        assert.equal(
          await procesamiento.marcarError(
            client, proyecto, idCapa, randomUUID(),
          ),
          null,
        );

        const fallida = await procesamiento.marcarError(
          client,
          proyecto,
          idCapa,
          primerIntento.procesamiento_token,
        );

        assert.equal(fallida.estado_procesamiento, 'ERROR');
        assert.equal(fallida.procesamiento_token, null);
        assert.equal(fallida.procesamiento_inicio, null);
        assert.ok(fallida.error_procesamiento);

        await prepararPendiente();

        const segundoIntento = await procesamiento.iniciar(
          client, proyecto, idCapa,
        );

        assert.ok(segundoIntento);
        assert.notEqual(
          segundoIntento.procesamiento_token,
          primerIntento.procesamiento_token,
        );

        await client.query(
          `
            UPDATE obra.capas
            SET crs_original = 'EPSG:32618',
                bbox_oeste = -74.1,
                bbox_sur = 4.6,
                bbox_este = -74.0,
                bbox_norte = 4.7,
                opacidad = 0.65,
                visible = FALSE,
                orden = 2
            WHERE id_capa = $1
          `,
          [idCapa],
        );

        const version = randomUUID();
        const publicacion = {
          version,
          proveedor: 'LOCAL',
          zoomMin: 12,
          zoomMax: 18,
          tamano: 256,
          total: '277',
        };

        // Un intento antiguo no puede publicar ni interrumpir al nuevo.
        assert.equal(
          await procesamiento.finalizar(
            client,
            proyecto,
            idCapa,
            primerIntento.procesamiento_token,
            publicacion,
          ),
          null,
        );

        assert.equal(
          await procesamiento.marcarError(
            client,
            proyecto,
            idCapa,
            primerIntento.procesamiento_token,
          ),
          null,
        );

        const resultado = await procesamiento.finalizar(
          client,
          proyecto,
          idCapa,
          segundoIntento.procesamiento_token,
          publicacion,
        );

        assert.ok(resultado);
        assert.equal(resultado.procesamiento_token, null);
        assert.equal(resultado.procesamiento_inicio, null);
        assert.equal(resultado.error_procesamiento, null);

        // Una finalización repetida no debe modificar la publicación.
        assert.equal(
          await procesamiento.finalizar(
            client,
            proyecto,
            idCapa,
            segundoIntento.procesamiento_token,
            { ...publicacion, version: randomUUID() },
          ),
          null,
        );

        assert.equal(resultado.estado_procesamiento, 'LISTA');
        assert.equal(resultado.crs_original, 'EPSG:32618');
        assert.equal(Number(resultado.bbox_oeste), -74.1);
        assert.equal(Number(resultado.opacidad), 0.65);
        assert.equal(resultado.visible, false);
        assert.equal(resultado.orden, 2);
        assert.equal(resultado.original_key, clave);
        assert.equal(resultado.teselas_version, version);
        assert.equal(resultado.teselas_total, '277');

        // Publicar teselas propias no requiere recursos de Raster MTS.
        assert.equal(resultado.mapbox_source_id, null);
        assert.equal(resultado.mapbox_tileset_id, null);
        assert.equal(resultado.mapbox_job_id, null);

        // No permite dejar una publicación incompleta o incoherente.
        for (const asignacion of [
          'teselas_version = NULL',
          'teselas_proveedor = NULL',
          "teselas_proveedor = 'OTRO'",
          'teselas_zoom_min = -1',
          'teselas_zoom_max = 11',
          'teselas_tamano = 512',
          'teselas_total = 0',
          'teselas_total = NULL',
          'crs_original = NULL',
        ]) {
          await rechazar(() => client.query(
            `UPDATE obra.capas SET ${asignacion} WHERE id_capa = $1`,
            [idCapa],
          ));
        }

        // Ni siquiera retirar el conjunto completo es válido estando LISTA.
        await rechazar(() => client.query(
          `
            UPDATE obra.capas
            SET teselas_version = NULL,
                teselas_proveedor = NULL,
                teselas_zoom_min = NULL,
                teselas_zoom_max = NULL,
                teselas_tamano = NULL,
                teselas_total = NULL
            WHERE id_capa = $1
          `,
          [idCapa],
        ));

        // Una capa pendiente tampoco puede tener metadatos parciales.
        const segunda = (
          await insertar(`capas/${randomUUID()}.tiff`)
        ).rows[0];

        await rechazar(() => client.query(
          'UPDATE obra.capas SET teselas_version = $2 WHERE id_capa = $1',
          [segunda.id_capa, randomUUID()],
        ));

        // Comprueba únicamente la cascada de metadatos.
        // La eliminación de archivos y recursos remotos será responsabilidad del backend.
        await client.query(
          'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
          [proyecto],
        );

        const restantes = await client.query(
          'SELECT id_capa FROM obra.capas WHERE id_proyecto = $1',
          [proyecto],
        );

        assert.equal(restantes.rowCount, 0);

        throw finalizar;
      }),
      (error) => error === finalizar,
    );
  } finally {
    await database.onApplicationShutdown();
  }
});