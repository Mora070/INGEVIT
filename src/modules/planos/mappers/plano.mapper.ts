import type {
  PlanoResponse,
  PlanoRow,
} from '../types/plano.types';

/**
 * Selecciona explícitamente los campos públicos.
 * No propaga claves internas ni futuras columnas del registro.
 */
export function mapearPlano(plano: PlanoRow): PlanoResponse {
  return {
    id_plano: plano.id_plano,
    id_proyecto: plano.id_proyecto,
    id_usuario_subida: plano.id_usuario_subida,
    titulo: plano.titulo,
    descripcion: plano.descripcion,
    url: plano.url,
    mime_type: plano.mime_type,
    fecha_subida: plano.fecha_subida.toISOString(),
  };
}