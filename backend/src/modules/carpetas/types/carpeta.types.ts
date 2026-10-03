/**
 * Registro de una carpeta recuperado desde PostgreSQL.
 *
 * Una carpeta siempre pertenece a un proyecto.
 * id_carpeta_padre = null representa una carpeta
 * ubicada directamente en la raíz del proyecto.
 */
export interface CarpetaRow {
  id_carpeta: string;
  id_proyecto: string;
  id_carpeta_padre: string | null;
  id_usuario_creacion: string;

  nombre: string;

  fecha_creacion: Date;
  fecha_actualizacion: Date;
}

/**
 * Representación pública de una carpeta.
 *
 * Las fechas se serializan como ISO 8601
 * antes de enviarse al frontend.
 */
export interface CarpetaResponse {
  id_carpeta: string;
  id_proyecto: string;
  id_carpeta_padre: string | null;
  id_usuario_creacion: string;

  nombre: string;

  fecha_creacion: string;
  fecha_actualizacion: string;
}

/**
 * Tipos de recursos que pueden organizarse
 * dentro de una carpeta.
 *
 * Los archivos originales continúan viviendo
 * en sus módulos correspondientes.
 */
export type TipoRecursoCarpeta =
  | 'FOTOGRAFIA'
  | 'PANORAMICA'
  | 'PLANO';

/**
 * Relación interna entre una fotografía existente
 * y una carpeta.
 *
 * No representa una copia física del archivo.
 */
export interface CarpetaFotografiaRow {
  id_proyecto: string;
  id_carpeta: string;
  id_fotografia: string;
  id_usuario_agrego: string;

  fecha_agregada: Date;
}

/**
 * Relación interna entre una panorámica 360°
 * existente y una carpeta.
 *
 * No representa una copia física del archivo.
 */
export interface CarpetaPanoramicaRow {
  id_proyecto: string;
  id_carpeta: string;
  id_panoramica: string;
  id_usuario_agrego: string;

  fecha_agregada: Date;
}

/**
 * Relación interna entre un plano existente
 * y una carpeta.
 *
 * No representa una copia física del archivo.
 */
export interface CarpetaPlanoRow {
  id_proyecto: string;
  id_carpeta: string;
  id_plano: string;
  id_usuario_agrego: string;

  fecha_agregada: Date;
}