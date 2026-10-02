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

const ANCHO_MINIMO_PANORAMICA =
  2048;

const ALTO_MINIMO_PANORAMICA =
  1024;

const PROPORCION_MINIMA_PANORAMICA =
  1.98;

const PROPORCION_MAXIMA_PANORAMICA =
  2.02;

/**
 * Determina si la imagen cumple las mismas condiciones
 * utilizadas por el módulo de panorámicas 360°.
 *
 * Si cumple:
 * - mínimo 2048 × 1024
 * - relación aproximada 2:1
 *
 * entonces debe cargarse desde el apartado 360°
 * y no desde Fotografías.
 */
async function esPanoramica360(
  original: Buffer,
): Promise<boolean> {
  try {
    const metadata =
      await sharp(
        original,
        {
          failOn:
            'warning',
        },
      ).metadata();

    let ancho =
      metadata.width;

    let alto =
      metadata.height;

    if (
      !ancho ||
      !alto
    ) {
      return false;
    }

    /*
     * Las orientaciones EXIF 5, 6, 7 y 8
     * intercambian ancho y alto visualmente.
     */
    if (
      metadata.orientation ===
        5 ||
      metadata.orientation ===
        6 ||
      metadata.orientation ===
        7 ||
      metadata.orientation ===
        8
    ) {
      [
        ancho,
        alto,
      ] = [
        alto,
        ancho,
      ];
    }

    if (
      ancho <
        ANCHO_MINIMO_PANORAMICA ||
      alto <
        ALTO_MINIMO_PANORAMICA
    ) {
      return false;
    }

    const proporcion =
      ancho /
      alto;

    return (
      proporcion >=
        PROPORCION_MINIMA_PANORAMICA &&
      proporcion <=
        PROPORCION_MAXIMA_PANORAMICA
    );
  } catch {
    return false;
  }
}

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
  const inspeccion =
    await inspeccionarFotografia(
      original,
    );

  const panoramica360 =
    await esPanoramica360(
      original,
    );

  if (
    panoramica360
  ) {
    throw new BadRequestException(
      'Las imágenes panorámicas 360° deben cargarse desde la sección 360°.',
    );
  }

  for (
    const escala of
      ESCALAS_FOTOGRAFIA_OPTIMIZADA
  ) {
    const ladoMaximo =
      Math.floor(
        MAX_LADO_FOTOGRAFIA_OPTIMIZADA *
          escala,
      );

    for (
      const calidad of
        CALIDADES_FOTOGRAFIA_OPTIMIZADA
    ) {
      let optimizada:
        Buffer;

      try {
        optimizada =
          await sharp(
            original,
            {
              failOn:
                'warning',
            },
          )
            .rotate()
            .resize({
              width:
                ladoMaximo,

              height:
                ladoMaximo,

              fit:
                'inside',

              withoutEnlargement:
                true,
            })
            .toFormat(
              FORMATO_FOTOGRAFIA_OPTIMIZADA,
              {
                quality:
                  calidad,

                effort:
                  4,
              },
            )
            .toBuffer();
      } catch {
        throw new BadRequestException(
          'No se pudo procesar la fotografía recibida.',
        );
      }

      if (
        optimizada.length >
          0 &&
        optimizada.length <=
          MAX_BYTES_FOTOGRAFIA_OPTIMIZADA
      ) {
        return {
          original,

          formatoOriginal:
            inspeccion.formato,

          optimizada,
        };
      }
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
  const resultado =
    await procesarFotografia(
      original,
    );

  return resultado.optimizada;
}