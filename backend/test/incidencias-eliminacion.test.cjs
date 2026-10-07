require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  IncidenciasRepository,
} = require('../dist/modules/incidencias/incidencias.repository');

const {
  IncidenciasEliminacionService,
} = require('../dist/modules/incidencias/incidencias-eliminacion.service');

// Mocks
class ActividadesRepositoryMock {
  async crear(client, datos) {
    assert.ok(client);
    assert.deepEqual(datos, {
      idProyecto: 'proyecto',
      idActor: 'creador',
      tipoAccion: 'INCIDENCIA_ELIMINADA',
      mensaje: 'Incidencia incidencia eliminada.',
    });
    return true;
  }
}

class NotificacionesRepositoryMock {
  async crearParaParticipantesProyecto(client, datos) {
    assert.ok(client);
    return 1; // simula que se insertó una notificación
  }
}

test('IncidenciasEliminar: incluye la autoría en el DELETE parametrizado', async () => {
  const repository = new IncidenciasRepository();

  const resultado = await repository.eliminarPropia(
    {
      async query(sql, valores) {
        assert.deepEqual(valores, [
          'proyecto', 'plano', 'incidencia', 'creador',
        ]);
        return { rowCount: 1, rows: [{ id_incidencia: 'incidencia' }] };
      },
    },
    'proyecto', 'plano', 'incidencia', 'creador',
  );

  assert.equal(resultado, true);
});

function preparar({ acceso = true, paginas = 2, eliminada = true, errorActividad } = {}) {
  const eventos = [];
  const client = {};

  const service = new IncidenciasEliminacionService(
    { async withTransaction(op) { await op(client); eventos.push('confirmar'); } },
    { async bloquearDisponible() { eventos.push('acceso'); return acceso; } },
    { async bloquearDisponible() { eventos.push('plano'); return paginas; } },
    { async eliminarPropia() { eventos.push('eliminar'); return eliminada; } },
    errorActividad ? { async crear() { throw errorActividad; } } : new ActividadesRepositoryMock(),
    new NotificacionesRepositoryMock()
  );

  return { eventos, ejecutar: () => service.eliminar('proyecto', 'plano', 'incidencia', 'creador') };
}

test('IncidenciasEliminar: registra la actividad antes de confirmar', async () => {
  const { ejecutar, eventos } = preparar();
  assert.equal(await ejecutar(), undefined);
  assert.deepEqual(eventos, ['acceso', 'plano', 'eliminar', 'confirmar']);
});
