import type {
  PanoramicaResponse,
  PanoramicaRow,
} from '../types/panoramica.types';

/**
 * Selecciona explícitamente los campos públicos.
 * Evita exponer la clave interna o futuras columnas del registro.
 */
export function mapearPanoramica(
  panoramica: PanoramicaRow,
): PanoramicaResponse {
  return {
    id_panoramica: panoramica.id_panoramica,
    id_proyecto: panoramica.id_proyecto,
    id_usuario_subida: panoramica.id_usuario_subida,
    titulo: panoramica.titulo,
    url: panoramica.url,
    mime_type: panoramica.mime_type,
    fecha_subida: panoramica.fecha_subida.toISOString(),
  };
}