export type EstadoProcesamientoCapa =
  | 'PENDIENTE'
  | 'PROCESANDO'
  | 'LISTA'
  | 'ERROR';

/**
 * Registro interno de PostgreSQL.
 *
 * pg devuelve numeric y bigint como texto con la configuración actual.
 * Las claves de almacenamiento y los identificadores de procesamiento
 * permanecen dentro del backend.
 */
export interface CapaRow {
  id_capa: string;
  id_proyecto: string;
  id_usuario_subida: string;

  nombre: string;
  descripcion: string;
  nombre_archivo_original: string;

  almacenamiento_proveedor: 'LOCAL' | 'S3';
  original_key: string;
  tamano_original_bytes: string;

  crs_original: string | null;
  bbox_oeste: string | null;
  bbox_sur: string | null;
  bbox_este: string | null;
  bbox_norte: string | null;

  estado_procesamiento: EstadoProcesamientoCapa;
  mapbox_source_id: string | null;
  mapbox_tileset_id: string | null;
  mapbox_job_id: string | null;
  error_procesamiento: string | null;

  opacidad: string;
  visible: boolean;
  orden: number;

  fecha_creacion: Date;
  fecha_actualizacion: Date;

  teselas_version: string | null;
  teselas_proveedor: 'LOCAL' | 'S3' | null;
  teselas_zoom_min: number | null;
  teselas_zoom_max: number | null;
  teselas_tamano: number | null;
  teselas_total: string | null;

  procesamiento_token: string | null;
  procesamiento_inicio: Date | null;
  procesamiento_vence: Date | null;
}



/**
 * Información pública de una colección publicada.
 *
 * No contiene rutas físicas ni datos del proveedor.
 * El conteo conserva la representación decimal de PostgreSQL bigint.
 */
export interface TeselasCapaResponse {
  version: string;
  zoom_min: number;
  zoom_max: number;
  tamano: number;
  total: string;
}

/**
 * Representación pública de una capa.
 *
 * El tamaño permanece como cadena decimal para evitar perder precisión.
 * bbox utiliza grados WGS84 en orden oeste, sur, este, norte.
 *
 * El mapeador expondrá mapbox_tileset_id únicamente cuando esté LISTA.
 * No incluye claves del original, trabajos internos ni errores técnicos.
 *  * Publica los metadatos de teselas únicamente cuando la capa está LISTA.
 */
export interface CapaResponse {
  id_capa: string;
  id_proyecto: string;
  id_usuario_subida: string;

  nombre: string;
  descripcion: string;
  nombre_archivo_original: string;
  tamano_original_bytes: string;

  crs_original: string | null;
  bbox: [number, number, number, number] | null;

  estado_procesamiento: EstadoProcesamientoCapa;
  teselas: TeselasCapaResponse | null;

  opacidad: number;
  visible: boolean;
  orden: number;

  fecha_creacion: string;
  fecha_actualizacion: string;
}