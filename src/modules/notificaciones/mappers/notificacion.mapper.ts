import type {
  NotificacionResponse,
  NotificacionRow,
} from '../types/notificacion.types';

/**
 * Selecciona explícitamente los campos de la respuesta pública.
 *
 * No utiliza propagación del registro para evitar publicar
 * información interna del procesamiento de correos.
 */
export function mapearNotificacion(
  notificacion: NotificacionRow,
): NotificacionResponse {
  return {
    id_notificacion: notificacion.id_notificacion,
    id_actor: notificacion.id_actor,
    id_proyecto: notificacion.id_proyecto,
    id_incidencia: notificacion.id_incidencia,
    tipo: notificacion.tipo,
    titulo: notificacion.titulo,
    mensaje: notificacion.mensaje,
    fecha_creacion: notificacion.fecha_creacion.toISOString(),
  };
}