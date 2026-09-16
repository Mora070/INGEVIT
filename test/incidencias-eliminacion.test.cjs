require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  IncidenciasRepository,
} = require('../dist/modules/incidencias/incidencias.repository');

const {
  IncidenciasEliminacionService,
} = require('../dist/modules/incidencias/incidencias-eliminacion.service');

test('IncidenciasEliminar: incluye la autoría en el DELETE parametrizado', async () => {
  const repository = new IncidenciasRepository();

  const resultado = await repository.eliminarPropia(
    {
      async query(sql, valores) {
        assert.deepEqual(valores, [
          'proyecto', 'plano', 'incidencia', 'creador',
        ]);
        assert.match(sql, /id_proyecto\s*=\s*\$1/i);
        assert.match(sql, /id_plano\s*=\s*\$2/i);
        assert.match(sql, /id_incidencia\s*=\s*\$3/i);
        assert.match(sql, /id_creador\s*=\s*\$4/i);

        return {
          rowCount: 1,
          rows: [{ id_incidencia: 'incidencia' }],
        };
      },
    },
    'proyecto', 'plano', 'incidencia', 'creador',
  );

  assert.equal(resultado, true);
});

test('IncidenciasEliminar: devuelve false cuando no encuentra una incidencia propia', async () => {
  const repository = new IncidenciasRepository();

  assert.equal(
    await repository.eliminarPropia(
      {
        async query() {
          return { rowCount: 0, rows: [] };
        },
      },
      'proyecto', 'plano', 'incidencia', 'creador',
    ),
    false,
  );
});

function preparar({
  acceso = true,
  paginas = 2,
  eliminada = true,
  errorActividad,
} = {}) {
  const eventos = [];
  const client = {};

  const service = new IncidenciasEliminacionService(
    {
      async withTransaction(operacion) {
        await operacion(client);
        eventos.push('confirmar');
      },
    },
    {
      async bloquearDisponible(conexion, proyecto, usuario) {
        assert.strictEqual(conexion, client);
        assert.deepEqual([proyecto, usuario], ['proyecto', 'creador']);
        eventos.push('acceso');
        return acceso;
      },
    },
    {
      async bloquearDisponible(conexion, proyecto, plano) {
        assert.strictEqual(conexion, client);
        assert.deepEqual([proyecto, plano], ['proyecto', 'plano']);
        eventos.push('plano');
        return paginas;
      },
    },
    {
      async eliminarPropia(conexion, ...ids) {
        assert.strictEqual(conexion, client);
        assert.deepEqual(ids, [
          'proyecto', 'plano', 'incidencia', 'creador',
        ]);
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
    ejecutar: () => service.eliminar(
      'proyecto', 'plano', 'incidencia', 'creador',
    ),
  };
}

test('IncidenciasEliminar: registra la actividad antes de confirmar', async () => {
  const { ejecutar, eventos } = preparar();

  assert.equal(await ejecutar(), undefined);
  assert.deepEqual(eventos, [
    'acceso', 'plano', 'eliminar', 'actividad', 'confirmar',
  ]);
});

for (const [nombre, opciones, esperados] of [
  ['sin acceso', { acceso: false }, ['acceso']],
  ['sin plano', { paginas: null }, ['acceso', 'plano']],
  ['incidencia ajena o inexistente', { eliminada: false }, [
    'acceso', 'plano', 'eliminar',
  ]],
]) {
  test(`IncidenciasEliminar: rechaza ${nombre}`, async () => {
    const { ejecutar, eventos } = preparar(opciones);

    await assert.rejects(
      ejecutar(),
      (error) => error.getStatus() === 404,
    );
    assert.deepEqual(eventos, esperados);
  });
}

test('IncidenciasEliminar: propaga el fallo del historial sin confirmar', async () => {
  const original = new Error('Falló la actividad');
  const { ejecutar, eventos } = preparar({
    errorActividad: original,
  });

  await assert.rejects(ejecutar(), (error) => error === original);
  assert.deepEqual(eventos, [
    'acceso', 'plano', 'eliminar', 'actividad',
  ]);
});