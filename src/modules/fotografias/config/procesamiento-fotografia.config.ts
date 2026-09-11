/**
 * Parámetros del procesamiento de fotografías.
 *
 * Los tamaños se expresan en bytes:
 * 1 MiB = 1024 × 1024 bytes.
 */
const BYTES_POR_MIB = 1024 * 1024;

/** Límite del archivo original recibido: requisito acordado. */
export const MAX_BYTES_FOTOGRAFIA_ORIGINAL =
  20 * BYTES_POR_MIB;

/**
 * Máximo objetivo de la versión optimizada.
 * No representa un tamaño mínimo: un resultado menor es válido.
 */
export const MAX_BYTES_FOTOGRAFIA_OPTIMIZADA =
  3 * BYTES_POR_MIB;

/**
 * Decisión técnica inicial para la versión web.
 * Se conserva la proporción y no se amplían imágenes pequeñas.
 */
export const MAX_LADO_FOTOGRAFIA_OPTIMIZADA = 2560;

/** Formato de salida de la versión optimizada. */
export const FORMATO_FOTOGRAFIA_OPTIMIZADA = 'webp' as const;

/**
 * Formatos de entrada permitidos.
 *
 * JPG y JPEG representan el mismo formato, identificado como "jpeg".
 * Estos valores se contrastarán con el contenido detectado,
 * no únicamente con la extensión o el MIME enviado por el cliente.
 */
export const FORMATOS_FOTOGRAFIA_ORIGINAL = [
  'jpeg',
  'png',
  'webp',
] as const;

export type FormatoFotografiaOriginal =
  (typeof FORMATOS_FOTOGRAFIA_ORIGINAL)[number];

  /**
 * Intentos de calidad, de mayor a menor.
 * Son valores del codificador WebP, no porcentajes de reducción de peso.
 */
export const CALIDADES_FOTOGRAFIA_OPTIMIZADA = [
  85,
  75,
  65,
] as const;

/**
 * Reducciones sucesivas respecto al lado máximo configurado.
 * Con 2560 píxeles producen límites de 2560, 1920 y 1280.
 */
export const ESCALAS_FOTOGRAFIA_OPTIMIZADA = [
  1,
  0.75,
  0.5,
] as const;