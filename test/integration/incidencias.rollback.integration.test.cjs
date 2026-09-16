require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  conAplicacionReal,
} = require('../helpers/con-aplicacion-real.cjs');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  ActividadesRepository,
} = require('../../dist/modules/actividades/actividades.repository');

const {
  IncidenciasCreacionService,
} = require('../../dist/modules/incidencias/incidencias-creacion.service');

const {
  IncidenciasEdicionService,
} = require('../../dist/modules/incidencias/incidencias-edicion.service');

const {
  IncidenciasEliminacionService,
} = require('../../dist/modules/incidencias/incidencias-eliminacion.service');

/**
 * Prepara registros exclusivos del escenario.
 *
 * No requiere un PDF físico: estas pruebas ejercitan transacciones
 * sobre los metadatos del plano y las incidencias.
 */
async function conEscenario(ejecutar) {
  await conAplicacionReal(async ({ app }) => {
    const database = app.get(DatabaseService);
    const usuario = randomUUID();
    const proyecto = randomUUID();
    const plano = randomUUID();

    try {
      await database.withTransaction(async (client) => {
        await client.query(
          `
            INSERT INTO obra.usuarios (
              id_usuario, correo, google_sub
            )
            VALUES ($1, $2, $3)
          `,
          [usuario, `${usuario}@example.invalid`, `integracion-${usuario}`],
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
            usuario,
            'Proyecto temporal',
            'Reversión de incidencias',
            'Dirección temporal',
            'Contratante temporal',
            '2026-09-15',
            'ACTIVA',
          ],
        );

        await client.query(
          `
            INSERT INTO obra.planos (
              id_plano, id_proyecto, id_usuario_subida,
              titulo, descripcion, url, s3_key, numero_paginas
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 2)
          `,
          [
            plano,
            proyecto,
            usuario,
            'Plano temporal',
            '',
            '/plano-temporal.pdf',
            `planos/${randomUUID()}.pdf`,
          ],
        );
      });

      await ejecutar({ app, database, usuario, proyecto, plano });
    } finally {
      await database.withTransaction(async (client) => {
        await client.query(
          'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
          [proyecto],
        );

        await client.query(
          'DELETE FROM obra.usuarios WHERE id_usuario = $1',
          [usuario],
        );
      });
    }
  });
}

/**
 * Introduce una violación NOT NULL dentro de la misma transacción.
 * DatabaseService y su ROLLBACK se ejecutan realmente.
 */
async function provocarFalloHistorial(client, proyecto, usuario, tipo) {
  await client.query(
    `
      INSERT INTO obra.actividades (
        id_proyecto, id_actor, tipo_accion, mensaje
      )
      VALUES ($1, $2, $3, NULL)
    `,
    [proyecto, usuario, tipo],
  );
}

const DATOS = {
  titulo: 'Incidencia original',
  descripcion: 'Descripción original',
  prioridad: 'MEDIA',
  numero_pagina: 2,
  coordenada_x: 120.5,
  coordenada_y: 80.25,
};

test('incidencias creación: revierte la inserción cuando falla el historial', async (t) => {
  await conEscenario(async ({
    app, database, usuario, proyecto, plano,
  }) => {
    const creacion = app.get(IncidenciasCreacionService);
    const actividades = app.get(ActividadesRepository);
    let insercionObservada = false;

    const sustituida = t.mock.method(
      actividades,
      'crear',
      async (client, datos) => {
        assert.equal(datos.tipoAccion, 'INCIDENCIA_CREADA');

        const pendientes = await client.query(
          `
            SELECT id_creador, numero_pagina, estado
            FROM obra.incidencias
            WHERE id_proyecto = $1
          `,
          [proyecto],
        );

        assert.deepEqual(pendientes.rows, [{
          id_creador: usuario,
          numero_pagina: 2,
          estado: 'PENDIENTE',
        }]);

        insercionObservada = true;

        await provocarFalloHistorial(
          client, proyecto, usuario, datos.tipoAccion,
        );
      },
    );

    try {
      await assert.rejects(
        creacion.crear(proyecto, plano, usuario, DATOS),
        (error) => error.code === '23502',
      );

      assert.equal(insercionObservada, true);

      const incidencias = await database.query(
        'SELECT id_incidencia FROM obra.incidencias WHERE id_proyecto = $1',
        [proyecto],
      );

      const historial = await database.query(
        'SELECT id_actividad FROM obra.actividades WHERE id_proyecto = $1',
        [proyecto],
      );

      assert.equal(incidencias.rows.length, 0);
      assert.equal(historial.rows.length, 0);
    } finally {
      sustituida.mock.restore();
    }
  });
});

test('incidencias edición: restaura todos los campos cuando falla el historial', async (t) => {
  await conEscenario(async ({
    app, database, usuario, proyecto, plano,
  }) => {
    const creacion = app.get(IncidenciasCreacionService);
    const edicion = app.get(IncidenciasEdicionService);
    const actividades = app.get(ActividadesRepository);

    // La creación y su actividad se confirman antes de probar la edición.
    const creada = await creacion.crear(
      proyecto, plano, usuario, DATOS,
    );

    const original = await database.query(
      'SELECT * FROM obra.incidencias WHERE id_incidencia = $1',
      [creada.id_incidencia],
    );

    const historialOriginal = await database.query(
      'SELECT * FROM obra.actividades WHERE id_proyecto = $1',
      [proyecto],
    );

    const cambios = {
      titulo: 'Cambio que debe revertirse',
      descripcion: 'Descripción que debe revertirse',
      prioridad: 'ALTA',
      estado: 'SOLUCIONADA',
    };

    let actualizacionObservada = false;

    const sustituida = t.mock.method(
      actividades,
      'crear',
      async (client, datos) => {
        assert.equal(datos.tipoAccion, 'INCIDENCIA_DATOS_GUARDADOS');

        const pendiente = await client.query(
          `
            SELECT titulo, descripcion, prioridad, estado
            FROM obra.incidencias
            WHERE id_incidencia = $1
          `,
          [creada.id_incidencia],
        );

        assert.deepEqual(pendiente.rows, [cambios]);
        actualizacionObservada = true;

        await provocarFalloHistorial(
          client, proyecto, usuario, datos.tipoAccion,
        );
      },
    );

    try {
      await assert.rejects(
        edicion.actualizarDatos(
          proyecto, plano, creada.id_incidencia, usuario, cambios,
        ),
        (error) => error.code === '23502',
      );

      assert.equal(actualizacionObservada, true);

      const posterior = await database.query(
        'SELECT * FROM obra.incidencias WHERE id_incidencia = $1',
        [creada.id_incidencia],
      );

      const historialPosterior = await database.query(
        'SELECT * FROM obra.actividades WHERE id_proyecto = $1',
        [proyecto],
      );

      assert.deepEqual(posterior.rows, original.rows);
      assert.deepEqual(historialPosterior.rows, historialOriginal.rows);
    } finally {
      sustituida.mock.restore();
    }
  });
});

test('incidencias eliminación: restaura la incidencia cuando falla el historial', async (t) => {
  await conEscenario(async ({
    app, database, usuario, proyecto, plano,
  }) => {
    const creacion = app.get(IncidenciasCreacionService);
    const eliminacion = app.get(IncidenciasEliminacionService);
    const actividades = app.get(ActividadesRepository);

    // Confirma la incidencia y su actividad antes de intentar eliminarla.
    const creada = await creacion.crear(
      proyecto,
      plano,
      usuario,
      DATOS,
    );

    const original = await database.query(
      'SELECT * FROM obra.incidencias WHERE id_incidencia = $1',
      [creada.id_incidencia],
    );

    assert.equal(original.rows.length, 1);

    const historialOriginal = await database.query(
      `
        SELECT *
        FROM obra.actividades
        WHERE id_proyecto = $1
        ORDER BY id_actividad
      `,
      [proyecto],
    );

    let eliminacionObservada = false;

    const sustituida = t.mock.method(
      actividades,
      'crear',
      async (client, datos) => {
        assert.deepEqual(datos, {
          idProyecto: proyecto,
          idActor: usuario,
          tipoAccion: 'INCIDENCIA_ELIMINADA',
          mensaje: `Incidencia ${creada.id_incidencia} eliminada.`,
        });

        /*
         * La conexión transaccional ya no debe ver la incidencia.
         * Así confirmamos que el fallo sucede después del DELETE.
         */
        const duranteEliminacion = await client.query(
          `
            SELECT id_incidencia
            FROM obra.incidencias
            WHERE id_incidencia = $1
          `,
          [creada.id_incidencia],
        );

        assert.equal(duranteEliminacion.rows.length, 0);
        eliminacionObservada = true;

        await provocarFalloHistorial(
          client,
          proyecto,
          usuario,
          datos.tipoAccion,
        );
      },
    );

    try {
      await assert.rejects(
        eliminacion.eliminar(
          proyecto,
          plano,
          creada.id_incidencia,
          usuario,
        ),
        (error) => {
          assert.equal(error.code, '23502');
          return true;
        },
      );

      assert.equal(eliminacionObservada, true);

      // Fuera de la transacción fallida, la incidencia debe estar restaurada.
      const posterior = await database.query(
        'SELECT * FROM obra.incidencias WHERE id_incidencia = $1',
        [creada.id_incidencia],
      );

      assert.deepEqual(posterior.rows, original.rows);

      const historialPosterior = await database.query(
        `
          SELECT *
          FROM obra.actividades
          WHERE id_proyecto = $1
          ORDER BY id_actividad
        `,
        [proyecto],
      );

      assert.deepEqual(
        historialPosterior.rows,
        historialOriginal.rows,
      );
    } finally {
      sustituida.mock.restore();
    }
  });
});