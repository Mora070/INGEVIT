/**
 * Registro de una fotografía recuperado desde PostgreSQL.
 *
 * Contiene únicamente metadatos y referencias.
 * El archivo físico se almacena fuera de la base de datos.
 */
export interface FotografiaRow {
  id_fotografia: string;
  id_proyecto: string;
  id_usuario_subida: string;
  titulo: string;
  url: string;
  s3_key: string;
  fecha_subida: Date;
}

/**
 * Representación pública de una fotografía.
 *
 * s3_key se mantiene como detalle interno del almacenamiento.
 * El frontend utilizará id_fotografia para solicitar operaciones
 * al backend y url para acceder al recurso según el mecanismo
 * de autorización que implementemos.
 */
export interface FotografiaResponse {
  id_fotografia: string;
  id_proyecto: string;
  id_usuario_subida: string;
  titulo: string;
  url: string;
  fecha_subida: string;
}