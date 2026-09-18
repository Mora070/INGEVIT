const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  mapearNotificacion,
} = require('../dist/modules/notificaciones/mappers/notificacion.mapper');

function crearFila(cambios = {}) {
  return {
    id_notificacion: 'notificacion',
    id_receptor: 'receptor',
    id_actor: 'actor',
    id_proyecto: 'proyecto',
    id_incidencia: 'incidencia',
    tipo: 'INCIDENCIA_CREADA',
    titulo: 'Nueva incidencia',
    mensaje: 'Se registró una incidencia en el proyecto.',
    estado_envio_correo: 'PENDIENTE',
    fecha_creacion: new Date('2026-09-16T12:00:00.000Z'),
    ...cambios,
  };
}

test('NotificacionMapper: devuelve únicamente campos públicos', () => {
  const resultado = mapearNotificacion(crearFila({
    dato_interno: 'no publicar',
  }));

  assert.deepEqual(resultado, {
    id_notificacion: 'notificacion',
    id_actor: 'actor',
    id_proyecto: 'proyecto',
    id_incidencia: 'incidencia',
    tipo: 'INCIDENCIA_CREADA',
    titulo: 'Nueva incidencia',
    mensaje: 'Se registró una incidencia en el proyecto.',
    fecha_creacion: '2026-09-16T12:00:00.000Z',
  });
});

test('NotificacionMapper: conserva la ausencia de una incidencia eliminada', () => {
  const resultado = mapearNotificacion(crearFila({
    id_incidencia: null,
  }));

  assert.equal(resultado.id_incidencia, null);
  assert.equal(resultado.id_proyecto, 'proyecto');
});

test('NotificacionMapper: no modifica el registro recibido', () => {
  const fila = crearFila();
  const copia = { ...fila };
  const fechaOriginal = fila.fecha_creacion;

  mapearNotificacion(fila);

  assert.deepEqual(fila, copia);
  assert.strictEqual(fila.fecha_creacion, fechaOriginal);
});