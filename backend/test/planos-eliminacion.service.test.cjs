require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  PlanosRepository,
} = require('../dist/modules/planos/planos.repository');

const {
  PlanosEliminacionService,
} = require('../dist/modules/planos/planos-eliminacion.service');

const CLAVE = 'planos/30000000-0000-4000-8000-000000000001.pdf';

function preparar({
  acceso = true,
  existe = true,
  errorCola,
  errorActividad,
} = {}) {
  const eventos = [];

  const client = {
    async query(sql, valores) {
      assert.deepEqual(valores, ['proyecto', 'plano']);
      assert.match(sql, /DELETE FROM obra\.planos/i);
      assert.match(sql, /WHERE\s+id_proyecto\s*=\s*\$1/i);
      assert.match(sql, /AND\s+id_plano\s*=\s*\$2/i);
      assert.match(sql, /RETURNING[\s\S]*s3_key/i);

      eventos.push('eliminar');

      return existe ? {
        rowCount: 1,
        rows: [{
          id_plano: 'plano',
          s3_key: CLAVE,
          titulo: 'Plano general',
        }],
      } : {
        rowCount: 0,
        rows: [],
      };
    },
  };

  const service = new PlanosEliminacionService(
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
    new PlanosRepository(),
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
          tipoAccion: 'PLANO_ELIMINADO',
          mensaje: 'Plano plano eliminado.',
        });
        eventos.push('actividad');

        if (errorActividad) throw errorActividad;
      },
    },
    {
      async crearParaParticipantesProyecto(conexion) {
        assert.strictEqual(conexion, client);
        eventos.push('notificacion');
      },
    },
  );

  return {
    eventos,
    ejecutar: () => service.eliminar(
      'proyecto', 'plano', 'usuario',
    ),
  };
}

test('PlanosEliminacion: elimina, encola y registra actividad en la misma transacción', async () => {
  const { ejecutar, eventos } = preparar();

  assert.equal(await ejecutar(), undefined);
  assert.deepEqual(eventos, [
    'acceso', 'eliminar', 'cola', 'actividad', 'notificacion', 'confirmar',
  ]);
});

test('PlanosEliminacion: rechaza el acceso antes de eliminar', async () => {
  const { ejecutar, eventos } = preparar({ acceso: false });

  await assert.rejects(ejecutar(), (error) => error.getStatus() === 404);
  assert.deepEqual(eventos, ['acceso']);
});

test('PlanosEliminacion: no encola un plano inexistente', async () => {
  const { ejecutar, eventos } = preparar({ existe: false });

  await assert.rejects(ejecutar(), (error) => {
    assert.equal(error.getStatus(), 404);
    assert.equal(error.message, 'El plano no está disponible.');
    return true;
  });

  assert.deepEqual(eventos, ['acceso', 'eliminar']);
});

test('PlanosEliminacion: propaga el fallo de la cola sin confirmar', async () => {
  const original = new Error('Falló la cola');
  const { ejecutar, eventos } = preparar({ errorCola: original });

  await assert.rejects(ejecutar(), (error) => error === original);
  assert.deepEqual(eventos, ['acceso', 'eliminar', 'cola']);
});

test('PlanosEliminacion: propaga el fallo de actividad sin confirmar', async () => {
  const original = new Error('Falló el historial');
  const { ejecutar, eventos } = preparar({
    errorActividad: original,
  });

  await assert.rejects(ejecutar(), (error) => error === original);
  assert.deepEqual(eventos, [
    'acceso', 'eliminar', 'cola', 'actividad',
  ]);
});