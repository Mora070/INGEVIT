import type {
  ActividadResponse,
  ActividadRow,
} from '../types/actividad.types';

/**
 * Construye la representación pública de una actividad.
 *
 * Selecciona explícitamente los campos de la respuesta y conserva
 * el registro original sin modificaciones.
 *
 * La fecha se convierte a ISO 8601 en UTC. El frontend será responsable
 * de presentarla en la zona horaria correspondiente.
 */
export function mapearActividad(
  actividad: ActividadRow,
): ActividadResponse {
  return {
    id_actividad: actividad.id_actividad,
    id_proyecto: actividad.id_proyecto,
    id_actor: actividad.id_actor,
    tipo_accion: actividad.tipo_accion,
    mensaje: actividad.mensaje,
    fecha_creacion: actividad.fecha_creacion.toISOString(),
  };
}