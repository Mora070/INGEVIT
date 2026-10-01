import type {
  NotificacionResponse,
  NotificacionRow,
} from '../types/notificacion.types';

export function mapearNotificacion(
  notificacion: NotificacionRow,
): NotificacionResponse {
  return {
    id_notificacion:
      notificacion.id_notificacion,

    id_actor:
      notificacion.id_actor,

    id_proyecto:
      notificacion.id_proyecto,

    id_incidencia:
      notificacion.id_incidencia,

    tipo:
      notificacion.tipo,

    titulo:
      notificacion.titulo,

    mensaje:
      notificacion.mensaje,

    destino:
      notificacion.destino,

    id_recurso:
      notificacion.id_recurso,

    leida:
      notificacion.leida,

    fecha_leida:
      notificacion.fecha_leida
        ? notificacion.fecha_leida.toISOString()
        : null,

    fecha_creacion:
      notificacion.fecha_creacion.toISOString(),
  };
}