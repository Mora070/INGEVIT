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
  ArchivosPendientesRepository,
} = require('../../dist/modules/almacenamiento/archivos-pendientes.repository');

const {
  ArchivosPendientesService,
} = require('../../dist/modules/almacenamiento/archivos-pendientes.service');

/**
 * Simula una tarea incorrectamente registrada para un PDF en uso.
 *
 * El procesador debe conservar el archivo y la tarea, incluso cuando
 * el proyecto está inactivo. La inactividad no elimina referencias.
 */
test('planos pendientes: conserva un PDF referenciado por un proyecto inactivo', async () => {
  await conAplicacionReal(async ({ app, raizTemporal }) => {
    const database = app.get(DatabaseService);
    const subida = app.get(PlanosSubidaService);
    const pendientes = app.get(ArchivosPendientesRepository);
    const procesador = app.get(ArchivosPendientesService);

    const propietario = randomUUID();
    const proyecto = randomUUID();

    let clave;

    try {
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
            'Protección de PDF referenciado',
            'Dirección temporal',
            'Contratante temporal',
            '2026-09-15',
            'ACTIVA',
          ],
        );
      });

      const documento = await PDFDocument.create();
      documento.addPage([200, 300]);
      const original = Buffer.from(await documento.save());

      const plano = await subida.subir(
        proyecto,
        propietario,
        { titulo: 'Plano que debe conservarse', descripcion: '' },
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

      await database.withTransaction(async (client) => {
        await client.query(
          `
            UPDATE obra.proyectos
            SET activo = FALSE
            WHERE id_proyecto = $1
          `,
          [proyecto],
        );

        /*
         * Incumplimos deliberadamente el contrato del productor:
         * encolamos un archivo que todavía tiene una referencia.
         * Esto permite comprobar la defensa del procesador.
         */
        await pendientes.registrar(client, [clave]);
      });

      await assert.rejects(
        procesador.procesarSiguiente(),
        {
          message:
            'El archivo pendiente continúa referenciado por un plano.',
        },
      );

      assert.deepEqual(await readFile(rutaArchivo), original);

      const conservados = await database.query(
        `
          SELECT
            EXISTS (
              SELECT 1 FROM obra.planos
              WHERE id_plano = $1 AND s3_key = $2
            ) AS plano,
            EXISTS (
              SELECT 1 FROM obra.archivos_pendientes_eliminacion
              WHERE s3_key = $2
            ) AS tarea
        `,
        [plano.id_plano, clave],
      );

      assert.deepEqual(conservados.rows, [{
        plano: true,
        tarea: true,
      }]);
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
          'DELETE FROM obra.usuarios WHERE id_usuario = $1',
          [propietario],
        );
      });
    }
  });
});