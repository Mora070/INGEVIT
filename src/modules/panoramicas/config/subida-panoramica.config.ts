import type {
  MulterOptions,
} from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

/** Límite acordado: 50 MB decimales, no 50 MiB. */
export const MAX_BYTES_PANORAMICA = 50_000_000;

/**
 * Recibe un archivo por solicitud.
 *
 * El byte adicional permite admitir exactamente el límite funcional.
 * El pipe comprueba después la longitud real del Buffer.
 */
export function getSubidaPanoramicaConfig(): MulterOptions {
  return {
    limits: {
      files: 1,
      fileSize: MAX_BYTES_PANORAMICA + 1,
    },
  };
}