import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

import {
  MAX_BYTES_FOTOGRAFIA_ORIGINAL,
} from './procesamiento-fotografia.config';

/**
 * Configuración de recepción HTTP de una fotografía.
 *
 * Decisión técnica:
 * Cada petición transporta una fotografía. Una futura selección múltiple
 * en el frontend podrá enviar varias peticiones.
 *
 * El límite se aplica durante la recepción, antes de procesar la imagen.
 * La inspección del contenido conserva su propia comprobación de tamaño
 * porque el servicio también puede invocarse fuera del controlador.
 */
export function getSubidaFotografiaConfig(): MulterOptions {
  return {
    limits: {
      files: 1,
      fileSize: MAX_BYTES_FOTOGRAFIA_ORIGINAL,
    },
  };
}