import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';

import sharp from 'sharp';

import {
  CALIDADES_FOTOGRAFIA_OPTIMIZADA,
  ESCALAS_FOTOGRAFIA_OPTIMIZADA,
  FORMATO_FOTOGRAFIA_OPTIMIZADA,
  MAX_BYTES_FOTOGRAFIA_OPTIMIZADA,
  MAX_LADO_FOTOGRAFIA_OPTIMIZADA,
} from '../config/procesamiento-fotografia.config';

import {
  inspeccionarFotografia,
} from './inspeccionar-fotografia';

import type {
  FotografiaProcesada,
} from '../types/fotografia-procesada.types';

/**
 * Prepara ambas versiones de una fotografía.
 *
 * Inspecciona el original una sola vez y genera una versión optimizada.
 * No escribe archivos ni modifica PostgreSQL.
 *
 * El Buffer original se conserva por referencia para evitar una copia
 * adicional de hasta 20 MiB. El consumidor no debe modificar sus bytes.
 */
export async function procesarFotografia(
  original: Buffer,
): Promise<FotografiaProcesada> {
  const inspeccion = await inspeccionarFotografia(original);

  for (const escala of ESCALAS_FOTOGRAFIA_OPTIMIZADA) {
    const ladoMaximo = Math.floor(
      MAX_LADO_FOTOGRAFIA_OPTIMIZADA * escala,
    );

    for (const calidad of CALIDADES_FOTOGRAFIA_OPTIMIZADA) {
      let optimizada: Buffer;

      try {
        optimizada = await sharp(original, {
          failOn: 'warning',
        })
          // Aplica la orientación EXIF antes de redimensionar.
          .rotate()
          .resize({
            width: ladoMaximo,
            height: ladoMaximo,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toFormat(FORMATO_FOTOGRAFIA_OPTIMIZADA, {
            quality: calidad,
            effort: 4,
          })
          .toBuffer();
      } catch {
        /*
         * Leer la cabecera puede funcionar aunque la decodificación
         * posterior falle. No continuamos con otra calidad en ese caso.
         */
        throw new BadRequestException(
          'No se pudo procesar la fotografía recibida.',
        );
      }

      // Nunca devolvemos un archivo que supere el máximo acordado.
      if (
        optimizada.length > 0
        && optimizada.length <= MAX_BYTES_FOTOGRAFIA_OPTIMIZADA
      ) return {
        original,
        formatoOriginal: inspeccion.formato,
        optimizada,
      };
    }
  }

  throw new UnprocessableEntityException(
    'No se pudo generar una versión optimizada de hasta 3 MiB con los parámetros configurados.',
  );
}

/**
 * Obtiene únicamente la versión optimizada.
 *
 * Delega en el procesamiento completo para mantener un único lugar
 * responsable de la inspección y de los intentos de optimización.
 */
export async function optimizarFotografia(
  original: Buffer,
): Promise<Buffer> {
  const resultado = await procesarFotografia(original);

  return resultado.optimizada;
}