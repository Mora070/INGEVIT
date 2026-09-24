require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  IncidenciasRepository,
} = require('../dist/modules/incidencias/incidencias.repository');
const {
  IncidenciasMapaEliminacionService,
} = require('../dist/modules/incidencias/incidencias-mapa-eliminacion.service');

test('eliminarPropiaEnMapa: exige proyecto, autoría y ausencia de plano', async () => {
  const repositorio = new IncidenciasRepository();

  const resultado = await repositorio.eliminarPropiaEnMapa({
    async query(sql, valores) {
      assert.deepEqual(valores, ['proyecto', 'incidencia', 'creador']);
      assert.match(sql, /id_proyecto\s*=\s*\$1::uuid/i);
      assert.match(sql, /id_incidencia\s*=\s*\$2::uuid/i);
      assert.match(sql, /id_creador\s*=\s*\$3::uuid/i);
      assert.match(sql, /id_plano\s+IS\s+NULL/i);

      return {
        rowCount: 1,
        rows: [{ id_incidencia: 'incidencia' }],
      };
    },
  }, 'proyecto', 'incidencia', 'creador');

  assert.equal(resultado, true);
});

test('eliminarPropiaEnMapa: devuelve false si ninguna fila coincide', async () => {
  const repositorio = new IncidenciasRepository();

  assert.equal(
    await repositorio.eliminarPropiaEnMapa({
      async query() {
        return { rowCount: 0, rows: [] };
      },
    }, 'proyecto', 'incidencia', 'creador'),
    false,
  );
});

test('eliminarPropiaEnMapa: rechaza respuestas inconsistentes', async () => {
  const repositorio = new IncidenciasRepository();

  for (const respuesta of [
    { rowCount: 1, rows: [] },
    { rowCount: 0, rows: [{ id_incidencia: 'incidencia' }] },
    { rowCount: 1, rows: [{ id_incidencia: 'otra' }] },
    { rowCount: 2, rows: [{}, {}] },
  ]) {
    await assert.rejects(
      repositorio.eliminarPropiaEnMapa({
        async query() {
          return respuesta;
        },
      }, 'proyecto', 'incidencia', 'creador'),
      /resultado inesperado/,
    );
  }
});

test('eliminarPropiaEnMapa: propaga errores de PostgreSQL', async () => {
  const repositorio = new IncidenciasRepository();
  const original = new Error('Fallo SQL');

  await assert.rejects(
    repositorio.eliminarPropiaEnMapa({
      async query() {
        throw original;
      },
    }, 'proyecto', 'incidencia', 'creador'),
    (error) => error === original,
  );
});

function preparar({
  acceso = true,
  eliminada = true,
  errorActividad,
} = {}) {
  const eventos = [];
  const client = {};

  const servicio = new IncidenciasMapaEliminacionService(
    {
      async withTransaction(operacion) {
        eventos.push('iniciar');
        const resultado = await operacion(client);
        eventos.push('confirmar');
        return resultado;
      },
    },
    {
      async bloquearDisponible(conexion, proyecto, usuario) {
        assert.strictEqual(conexion, client);
        assert.deepEqual([proyecto, usuario], ['proyecto', 'creador']);
        eventos.push('autorizar');
        return acceso;
      },
    },
    {
      async eliminarPropiaEnMapa(conexion, proyecto, incidencia, usuario) {
        assert.strictEqual(conexion, client);
        assert.deepEqual(
          [proyecto, incidencia, usuario],
          ['proyecto', 'incidencia', 'creador'],
        );
        eventos.push('eliminar');
        return eliminada;
      },
    },
    {
      async crear(conexion, datos) {
        assert.strictEqual(conexion, client);
        assert.deepEqual(datos, {
          idProyecto: 'proyecto',
          idActor: 'creador',
          tipoAccion: 'INCIDENCIA_ELIMINADA',
          mensaje: 'Incidencia incidencia eliminada.',
        });
        eventos.push('actividad');
        if (errorActividad) throw errorActividad;
      },
    },
  );

  return {
    eventos,
    ejecutar: () => servicio.eliminar('proyecto', 'incidencia', 'creador'),
  };
}

test('eliminación de mapa: registra la actividad antes de confirmar', async () => {
  const escenario = preparar();

  assert.equal(await escenario.ejecutar(), undefined);
  assert.deepEqual(escenario.eventos, [
    'iniciar', 'autorizar', 'eliminar', 'actividad', 'confirmar',
  ]);
});

test('eliminación de mapa: rechaza proyectos sin acceso antes de borrar', async () => {
  const escenario = preparar({ acceso: false });

  await assert.rejects(
    escenario.ejecutar(),
    (error) => error.getStatus() === 404,
  );

  assert.deepEqual(escenario.eventos, ['iniciar', 'autorizar']);
});

test('eliminación de mapa: no registra actividad si no se elimina una fila', async () => {
  const escenario = preparar({ eliminada: false });

  await assert.rejects(escenario.ejecutar(), (error) => {
    assert.equal(error.getStatus(), 404);
    assert.equal(error.message, 'La incidencia no está disponible.');
    return true;
  });

  assert.deepEqual(escenario.eventos, [
    'iniciar', 'autorizar', 'eliminar',
  ]);
});

test('eliminación de mapa: no confirma si falla el historial', async () => {
  const original = new Error('Fallo de actividad');
  const escenario = preparar({ errorActividad: original });

  await assert.rejects(
    escenario.ejecutar(),
    (error) => error === original,
  );

  assert.deepEqual(escenario.eventos, [
    'iniciar', 'autorizar', 'eliminar', 'actividad',
  ]);
});