import type {
  FormatoFotografiaOriginal,
} from '../config/procesamiento-fotografia.config';

/**
 * Resultado interno del procesamiento de una fotografía.
 *
 * No representa una fila de PostgreSQL ni una respuesta HTTP.
 * Sus buffers contienen los archivos que se guardarán por separado.
 */
export interface FotografiaProcesada {
  /**
   * Bytes del archivo recibido, sin recodificación ni cambios de metadatos.
   *
   * No deben modificarse durante el almacenamiento.
   */
  readonly original: Buffer;

  /**
   * Formato detectado a partir del contenido original.
   *
   * Se utilizará para asignar una extensión interna coherente.
   * JPG y JPEG se representan como "jpeg".
   */
  readonly formatoOriginal: FormatoFotografiaOriginal;

  /**
   * Versión WebP estática que cumple el tamaño máximo configurado.
   */
  readonly optimizada: Buffer;
}