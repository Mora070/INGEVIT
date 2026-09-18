import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import sharp from 'sharp';

import {
  inspeccionarFotografia,
} from '../../fotografias/utils/inspeccionar-fotografia';

import {
  CALIDAD_WEBP_AVATAR,
  MAX_BYTES_AVATAR_ENTRADA,
  MAX_DIMENSION_AVATAR,
} from '../config/avatar.config';

/**
 * Produce exclusivamente el contenido WebP que se almacenará.
 *
 * - Valida el tamaño antes de inspeccionar la imagen.
 * - Reutiliza la detección de JPG/JPEG, PNG y WebP estáticos.
 * - Aplica la orientación EXIF antes de redimensionar.
 * - Conserva la proporción y no amplía imágenes pequeñas.
 * - No conserva metadatos EXIF ni devuelve una copia del original.
 *
 * Esta función no escribe archivos ni modifica PostgreSQL.
 */
export async function optimizarAvatar(
  contenido: Buffer,
): Promise<Buffer> {
  if (!Buffer.isBuffer(contenido) || contenido.length === 0) {
    throw new BadRequestException(
      'Debes proporcionar una fotografía de perfil no vacía.',
    );
  }

  if (contenido.length > MAX_BYTES_AVATAR_ENTRADA) {
    throw new PayloadTooLargeException(
      'La fotografía de perfil no puede superar 5 MiB.',
    );
  }

  // Conserva los errores específicos de formato e imagen animada.
  await inspeccionarFotografia(contenido);

  const procesamiento = sharp(contenido, {
    failOn: 'warning',
  });

  try {
    const { data, info } = await procesamiento
      .rotate()
      .resize({
        width: MAX_DIMENSION_AVATAR,
        height: MAX_DIMENSION_AVATAR,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: CALIDAD_WEBP_AVATAR,
      })
      .timeout({ seconds: 10 })
      .toBuffer({ resolveWithObject: true });

    if (
      data.length === 0 ||
      info.format !== 'webp' ||
      info.width < 1 ||
      info.height < 1 ||
      info.width > MAX_DIMENSION_AVATAR ||
      info.height > MAX_DIMENSION_AVATAR
    ) {
      throw new Error('El procesamiento produjo una salida inválida.');
    }

    return data;
  } catch {
    throw new BadRequestException(
      'No se pudo procesar la fotografía de perfil.',
    );
  } finally {
    procesamiento.destroy();
  }
}