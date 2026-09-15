require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readdir } = require('node:fs/promises');
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
  ActividadesRepository,
} = require('../../dist/modules/actividades/actividades.repository');

/**
 * Comprueba la compensación con PostgreSQL y almacenamiento reales.
 *
 * Provoca una violación NOT NULL al registrar la actividad.
 * La inserción del plano y la escritura del PDF se ejecutan realmente.
 */
test('planos subida: revierte el registro y elimina el archivo cuando falla la actividad', async (t) => {
  await conAplicacionReal(async ({ app, raizTemporal }) => {
    const database = app.get(DatabaseService);
    const subida = app.get(PlanosSubidaService);
    const actividades = app.get(ActividadesRepository);

    const propietario = randomUUID();
    const proyecto = randomUUID();
    const carpeta = path.join(raizTemporal, 'planos');

    const documento = await PDFDocument.create();
    documento.addPage([200, 300]);
    const contenido = Buffer.from(await documento.save());

    let falloProvocado = false;
    let sustituida;

    try {
      await database.withTransaction(async (client) => {
        /*
         * Cuenta exclusiva de Google para esta prueba de servicio.
         * No necesitamos una contraseña porque no probamos el login.
         */
        await client.query(
          `
            INSERT INTO obra.usuarios (
              id_usuario, correo, google_sub
            )
            VALUES ($1, $2, $3)
          `,
          [
            propietario,
            `${propietario}@example.invalid`,
            `integracion-${propietario}`,
          ],
        );

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
            'Prueba de reversión de planos',
            'Dirección temporal',
            'Contratante temporal',
            '2026-09-15',
            'ACTIVA',
          ],
        );
      });

      assert.deepEqual(await readdir(carpeta), []);

      sustituida = t.mock.method(
        actividades,
        'crear',
        async (client, datos) => {
          assert.equal(datos.idProyecto, proyecto);
          assert.equal(datos.idActor, propietario);
          assert.equal(datos.tipoAccion, 'PLANO_SUBIDO');

          /*
           * La misma conexión debe ver el plano insertado,
           * aunque la transacción todavía no se haya confirmado.
           */
          const planos = await client.query(
            `
              SELECT id_plano, s3_key
              FROM obra.planos
              WHERE id_proyecto = $1
            `,
            [proyecto],
          );

          assert.equal(planos.rows.length, 1);
          assert.equal(
            datos.mensaje,
            `Plano ${planos.rows[0].id_plano} subido.`,
          );

          // El PDF también debe existir antes de provocar el fallo.
          const archivos = await readdir(carpeta);

          assert.deepEqual(archivos, [
            planos.rows[0].s3_key.slice('planos/'.length),
          ]);

          falloProvocado = true;

          /*
           * Provocamos un error real de PostgreSQL: mensaje es NOT NULL.
           * No sustituimos DatabaseService ni la gestión de ROLLBACK.
           */
          await client.query(
            `
              INSERT INTO obra.actividades (
                id_proyecto, id_actor, tipo_accion, mensaje
              )
              VALUES ($1, $2, $3, NULL)
            `,
            [proyecto, propietario, 'PLANO_SUBIDO'],
          );
        },
      );

      await assert.rejects(
        subida.subir(
          proyecto,
          propietario,
          {
            titulo: 'Plano que debe revertirse',
            descripcion: 'Prueba de compensación',
          },
          contenido,
        ),
        (error) => {
          assert.equal(error.code, '23502');
          return true;
        },
      );

      assert.equal(falloProvocado, true);

      /*
       * Estas consultas usan el pool después de finalizar la operación.
       * No deben observar ni el plano ni una actividad confirmada.
       */
      const resultado = await database.query(
        `
          SELECT
            (
              SELECT COUNT(*)::text
              FROM obra.planos
              WHERE id_proyecto = $1
            ) AS planos,
            (
              SELECT COUNT(*)::text
              FROM obra.actividades
              WHERE id_proyecto = $1
            ) AS actividades
        `,
        [proyecto],
      );

      assert.deepEqual(resultado.rows, [{
        planos: '0',
        actividades: '0',
      }]);

      // La compensación debe haber eliminado el PDF guardado.
      assert.deepEqual(await readdir(carpeta), []);
    } finally {
      if (sustituida) {
        sustituida.mock.restore();
      }

      await database.withTransaction(async (client) => {
        await client.query(
          'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
          [proyecto],
        );

        await client.query(
          'DELETE FROM obra.usuarios WHERE id_usuario = $1',
          [propietario],
        );
      });
    }
  });
});