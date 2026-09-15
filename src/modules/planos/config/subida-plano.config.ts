import type {
  MulterOptions,
} from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

/** Límite funcional acordado para el archivo PDF original. */
export const MAX_BYTES_PLANO = 35 * 1024 * 1024;

/**
 * Recibe un plano por petición, en memoria.
 *
 * Busboy rechaza al alcanzar fileSize. Configuramos el primer
 * byte no permitido para admitir exactamente 35 MiB.
 */
export function getSubidaPlanoConfig(): MulterOptions {
  return {
    limits: {
      files: 1,
      fileSize: MAX_BYTES_PLANO + 1,
    },
  };
}