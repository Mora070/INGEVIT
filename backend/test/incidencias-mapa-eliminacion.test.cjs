require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  IncidenciasRepository,
} = require('../dist/modules/incidencias/incidencias.repository');
const {
  IncidenciasMapaEliminacionService,
} = require('../dist/modules/incidencias/incidencias-mapa-eliminacion.service');

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
    return 1;
  }
}

function preparar({ acceso = true, eliminada = true, errorActividad } = {}) {
  const eventos = [];
  const client = {};

  const servicio = new IncidenciasMapaEliminacionService(
    { async withTransaction(op) { eventos.push('iniciar'); const r = await op(client); eventos.push('confirmar'); return r; } },
    { async bloquearDisponible() { eventos.push('autorizar'); return acceso; } },
    { async eliminarPropiaEnMapa() { eventos.push('eliminar'); return eliminada; } },
    errorActividad ? { async crear() { throw errorActividad; } } : new ActividadesRepositoryMock(),
    new NotificacionesRepositoryMock()
  );

  return { eventos, ejecutar: () => servicio.eliminar('proyecto', 'incidencia', 'creador') };
}

test('eliminación de mapa: registra la actividad antes de confirmar', async () => {
  const escenario = preparar();
  assert.equal(await escenario.ejecutar(), undefined);
  assert.deepEqual(escenario.eventos, ['iniciar', 'autorizar', 'eliminar', 'confirmar']);
});
