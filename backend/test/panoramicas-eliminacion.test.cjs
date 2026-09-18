require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  PanoramicasRepository,
} = require('../dist/modules/panoramicas/panoramicas.repository');

const {
  PanoramicasEliminacionService,
} = require('../dist/modules/panoramicas/panoramicas-eliminacion.service');

const CLAVE = 'panoramicas/30000000-0000-4000-8000-000000000001.png';

function preparar({
  acceso = true,
  existe = true,
  errorCola,
  errorActividad,
} = {}) {
  const eventos = [];

  const client = {
    async query(sql, valores) {
      assert.deepEqual(valores, ['proyecto', 'panoramica']);
      assert.match(sql, /DELETE FROM obra\.panoramicas/i);
      assert.match(sql, /WHERE\s+id_proyecto\s*=\s*\$1/i);
      assert.match(sql, /AND\s+id_panoramica\s*=\s*\$2/i);
      assert.match(sql, /RETURNING[\s\S]*s3_key/i);

      eventos.push('eliminar');

      return existe ? {
        rowCount: 1,
        rows: [{
          id_panoramica: 'panoramica',
          s3_key: CLAVE,
        }],
      } : {
        rowCount: 0,
        rows: [],
      };
    },
  };

  const service = new PanoramicasEliminacionService(
    {
      async withTransaction(operacion) {
        await operacion(client);
        eventos.push('confirmar');
      },
    },
    {
      async bloquearDisponible(conexion, proyecto, usuario) {
        assert.strictEqual(conexion, client);
        assert.deepEqual([proyecto, usuario], ['proyecto', 'usuario']);
        eventos.push('acceso');
        return acceso;
      },
    },
    new PanoramicasRepository(),
    {
      async registrar(conexion, claves) {
        assert.strictEqual(conexion, client);
        assert.deepEqual(claves, [CLAVE]);
        eventos.push('cola');

        if (errorCola) throw errorCola;
      },
    },
    {
      async crear(conexion, datos) {
        assert.strictEqual(conexion, client);
        assert.deepEqual(datos, {
          idProyecto: 'proyecto',
          idActor: 'usuario',
          tipoAccion: 'PANORAMICA_ELIMINADA',
          mensaje: 'Panorámica panoramica eliminada.',
        });
        eventos.push('actividad');

        if (errorActividad) throw errorActividad;
      },
    },
  );

  return {
    eventos,
    ejecutar: () => service.eliminar(
      'proyecto', 'panoramica', 'usuario',
    ),
  };
}

test('PanoramicasEliminacion: elimina, encola y registra antes de confirmar', async () => {
  const { ejecutar, eventos } = preparar();

  assert.equal(await ejecutar(), undefined);
  assert.deepEqual(eventos, [
    'acceso', 'eliminar', 'cola', 'actividad', 'confirmar',
  ]);
});

test('PanoramicasEliminacion: rechaza el acceso antes de eliminar', async () => {
  const { ejecutar, eventos } = preparar({ acceso: false });

  await assert.rejects(ejecutar(), (error) => error.getStatus() === 404);
  assert.deepEqual(eventos, ['acceso']);
});

test('PanoramicasEliminacion: no encola una panorámica inexistente', async () => {
  const { ejecutar, eventos } = preparar({ existe: false });

  await assert.rejects(ejecutar(), (error) => {
    assert.equal(error.getStatus(), 404);
    assert.equal(error.message, 'La panorámica no está disponible.');
    return true;
  });

  assert.deepEqual(eventos, ['acceso', 'eliminar']);
});

test('PanoramicasEliminacion: propaga el fallo de la cola sin confirmar', async () => {
  const original = new Error('Falló la cola');
  const { ejecutar, eventos } = preparar({ errorCola: original });

  await assert.rejects(ejecutar(), (error) => error === original);
  assert.deepEqual(eventos, ['acceso', 'eliminar', 'cola']);
});

test('PanoramicasEliminacion: propaga el fallo de actividad sin confirmar', async () => {
  const original = new Error('Falló el historial');
  const { ejecutar, eventos } = preparar({
    errorActividad: original,
  });

  await assert.rejects(ejecutar(), (error) => error === original);
  assert.deepEqual(eventos, [
    'acceso', 'eliminar', 'cola', 'actividad',
  ]);
});