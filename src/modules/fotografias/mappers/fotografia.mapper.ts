import type {
  FotografiaResponse,
  FotografiaRow,
} from '../types/fotografia.types';

/**
 * Construye la representación pública de una fotografía.
 *
 * Selecciona explícitamente los campos que recibe el frontend,
 * excluyendo la clave interna de almacenamiento s3_key.
 *
 * Conserva el registro original y convierte la fecha a ISO 8601 en UTC.
 * No genera URLs ni comprueba permisos de acceso.
 */
export function mapearFotografia(
  fotografia: FotografiaRow,
): FotografiaResponse {
  return {
    id_fotografia: fotografia.id_fotografia,
    id_proyecto: fotografia.id_proyecto,
    id_usuario_subida: fotografia.id_usuario_subida,
    titulo: fotografia.titulo,
    url: fotografia.url,
    fecha_subida: fotografia.fecha_subida.toISOString(),
  };
}