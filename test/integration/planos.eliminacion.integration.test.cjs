require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { PDFDocument } = require('pdf-lib');

const {
  conAplicacionReal,
} = require('../helpers/con-aplicacion-real.cjs');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  PlanosSubidaService,
} = require('../../dist/modules/planos/planos-subida.service');

const {
  PlanosEliminacionService,
} = require('../../dist/modules/planos/planos-eliminacion.service');

const {
  ArchivosPendientesService,
} = require('../../dist/modules/almacenamiento/archivos-pendientes.service');

/**
 * Comprueba la eliminación con PostgreSQL y almacenamiento reales.
 *
 * El trabajador automático permanece deshabilitado.
 * Procesamos manualmente una tarea para comprobar cada etapa.
 */
test('planos eliminación: elimina las incidencias, conserva el historial y procesa el PDF pendiente', async () => {
  await conAplicacionReal(async ({ app, raizTemporal }) => {
    const database = app.get(DatabaseService);
    const subida = app.get(PlanosSubidaService);
    const eliminacion = app.get(PlanosEliminacionService);
    const procesador = app.get(ArchivosPendientesService);

    const propietario = randomUUID();
    const colaborador = randomUUID();
    const proyecto = randomUUID();
    const usuarios = [propietario, colaborador];

    let clave;

    try {
      /*
       * El procesador selecciona tareas de la cola compartida.
       * No debemos consumir tareas ajenas a esta prueba.
       */
      const colaInicial = await database.query(`
        SELECT EXISTS (
          SELECT 1 FROM obra.archivos_pendientes_eliminacion
        ) AS ocupada
      `);

      assert.equal(
        colaInicial.rows[0].ocupada,
        false,
        'La prueba requiere una cola vacía; no procesa tareas existentes.',
      );

      await database.withTransaction(async (client) => {
        for (const id of usuarios) {
          await client.query(
            `
              INSERT INTO obra.usuarios (
                id_usuario, correo, google_sub
              )
              VALUES ($1, $2, $3)
            `,
            [id, `${id}@example.invalid`, `integracion-${id}`],
          );
        }

        await client.query(
          `
            INSERT INTO obra.proyectos (
              id_proyecto, id_propietario, nombre, descripcion,
              direccion, contratante, fecha_inicio, estado_proyecto
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            proyecto,
            propietario,
            'Proyecto temporal',
            'Eliminación de planos',
            'Dirección temporal',
            'Contratante temporal',
            '2026-09-15',
            'ACTIVA',
          ],
        );

        await client.query(
          `
            INSERT INTO obra.usuario_proyecto (
              id_usuario, id_proyecto
            )
            VALUES ($1, $2)
          `,
          [colaborador, proyecto],
        );
      });

      const documento = await PDFDocument.create();
      documento.addPage([200, 300]);
      const original = Buffer.from(await documento.save());

      // El propietario sube el plano; el colaborador lo eliminará.
      const plano = await subida.subir(
        proyecto,
        propietario,
        { titulo: 'Plano temporal', descripcion: '' },
        original,
      );

      const registro = await database.query(
        'SELECT s3_key FROM obra.planos WHERE id_plano = $1',
        [plano.id_plano],
      );

      assert.equal(registro.rows.length, 1);
      clave = registro.rows[0].s3_key;
      assert.match(clave, /^planos\/[0-9a-f-]{36}\.pdf$/);

      const rutaArchivo = path.join(
        raizTemporal,
        ...clave.split('/'),
      );

      /*
       * Creamos incidencias de ambos usuarios.
       * Al eliminar el plano, todas sus incidencias deben desaparecer.
       */
      await database.withTransaction(async (client) => {
        for (const creador of usuarios) {
          await client.query(
            `
              INSERT INTO obra.incidencias (
                id_plano, id_proyecto, id_creador,
                titulo, descripcion, estado, prioridad,
                coordenada_x, coordenada_y, numero_pagina
              )
              VALUES (
                $1, $2, $3, $4, $5, 'PENDIENTE', 'MEDIA',
                0.5, 0.5, 1
              )
            `,
            [
              plano.id_plano,
              proyecto,
              creador,
              'Incidencia temporal',
              'Prueba de eliminación en cascada',
            ],
          );
        }
      });

      const antes = await database.query(
        `
          SELECT COUNT(*)::text AS total
          FROM obra.incidencias
          WHERE id_plano = $1
        `,
        [plano.id_plano],
      );

      assert.equal(antes.rows[0].total, '2');

      await eliminacion.eliminar(
        proyecto,
        plano.id_plano,
        colaborador,
      );

      const restantes = await database.query(
        `
          SELECT
            (
              SELECT COUNT(*)::text FROM obra.planos
              WHERE id_plano = $1
            ) AS planos,
            (
              SELECT COUNT(*)::text FROM obra.incidencias
              WHERE id_plano = $1
            ) AS incidencias
        `,
        [plano.id_plano],
      );

      assert.deepEqual(restantes.rows, [{
        planos: '0',
        incidencias: '0',
      }]);

      const tarea = await database.query(
        `
          SELECT s3_key
          FROM obra.archivos_pendientes_eliminacion
          WHERE s3_key = $1
        `,
        [clave],
      );

      assert.deepEqual(tarea.rows, [{ s3_key: clave }]);

      // La transacción no borra físicamente el PDF.
      assert.deepEqual(await readFile(rutaArchivo), original);

      // Repetir la eliminación no debe duplicar tareas ni actividades.
      await assert.rejects(
        eliminacion.eliminar(proyecto, plano.id_plano, colaborador),
        (error) => {
          assert.equal(error.getStatus(), 404);
          assert.equal(error.message, 'El plano no está disponible.');
          return true;
        },
      );

      const historial = await database.query(
        `
          SELECT id_actor, tipo_accion, mensaje
          FROM obra.actividades
          WHERE id_proyecto = $1
          ORDER BY tipo_accion
        `,
        [proyecto],
      );

      assert.deepEqual(historial.rows, [
        {
          id_actor: colaborador,
          tipo_accion: 'PLANO_ELIMINADO',
          mensaje: `Plano ${plano.id_plano} eliminado.`,
        },
        {
          id_actor: propietario,
          tipo_accion: 'PLANO_SUBIDO',
          mensaje: `Plano ${plano.id_plano} subido.`,
        },
      ]);

      // El procesador verifica referencias, borra el PDF y retira la tarea.
      assert.equal(await procesador.procesarSiguiente(), true);

      await assert.rejects(
        readFile(rutaArchivo),
        { code: 'ENOENT' },
      );

      const tareaFinal = await database.query(
        `
          SELECT s3_key
          FROM obra.archivos_pendientes_eliminacion
          WHERE s3_key = $1
        `,
        [clave],
      );

      assert.equal(tareaFinal.rows.length, 0);
    } finally {
      await database.withTransaction(async (client) => {
        if (clave) {
          await client.query(
            `
              DELETE FROM obra.archivos_pendientes_eliminacion
              WHERE s3_key = $1
            `,
            [clave],
          );
        }

        await client.query(
          'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
          [proyecto],
        );

        await client.query(
          'DELETE FROM obra.usuarios WHERE id_usuario = ANY($1::uuid[])',
          [usuarios],
        );
      });
    }
  });
});