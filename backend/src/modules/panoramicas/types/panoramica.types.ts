/** Tipos admitidos por la restricción de PostgreSQL. */
export type MimePanoramica =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

/**
 * Registro interno.
 * La clave de almacenamiento no debe exponerse en la respuesta pública.
 */
export interface PanoramicaRow {
  id_panoramica: string;
  id_proyecto: string;
  id_usuario_subida: string;
  titulo: string;
  url: string;
  s3_key: string;
  mime_type: MimePanoramica;
  fecha_subida: Date;
  /** PostgreSQL devuelve numeric como texto. */
  latitud: string | null;
  longitud: string | null;
}

/** Representación pública del registro de una imagen panorámica. */
export interface PanoramicaResponse {
  id_panoramica: string;
  id_proyecto: string;
  id_usuario_subida: string;
  titulo: string;
  url: string;
  mime_type: MimePanoramica;
  fecha_subida: string;
  /** Coordenadas WGS84; ambas null para registros antiguos sin ubicación. */
  latitud: number | null;
  longitud: number | null;
}