import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

import sharp from 'sharp';
import type { Metadata } from 'sharp';

import {
  leerFotogramasPng,
} from '../../../common/utils/leer-fotogramas-png';

import {
  MAX_BYTES_PANORAMICA,
} from '../config/subida-panoramica.config';

import type {
  MimePanoramica,
} from '../types/panoramica.types';

const ANCHO_MINIMO = 2048;
const ALTO_MINIMO = 1024;

const PROPORCION_MINIMA = 1.98;
const PROPORCION_MAXIMA = 2.02;

export interface PanoramicaInspeccionada {
  formato: 'jpeg' | 'png' | 'webp';

  mimeType:
    MimePanoramica;

  bytes:
    number;

  ancho:
    number;

  alto:
    number;

  proporcionDosAUno:
    boolean;
}

/**
 * Inspecciona una imagen estática sin modificar sus bytes.
 *
 * Las dimensiones devueltas consideran la orientación EXIF.
 *
 * La proporción aproximada 2:1 permite descartar imágenes que
 * claramente no son adecuadas para un visor equirectangular.
 *
 * Esta comprobación geométrica no puede certificar por sí sola
 * que la imagen represente una esfera 360° completa.
 */
export async function inspeccionarPanoramica(
  contenido: Buffer,
): Promise<PanoramicaInspeccionada> {
  if (
    !Buffer.isBuffer(
      contenido,
    ) ||
    contenido.length === 0
  ) {
    throw new BadRequestException(
      'Debes proporcionar una imagen panorámica no vacía.',
    );
  }

  if (
    contenido.length >
    MAX_BYTES_PANORAMICA
  ) {
    throw new PayloadTooLargeException(
      'La panorámica no puede superar 50 MB.',
    );
  }

  let metadatos:
    Metadata;

  try {
    metadatos =
      await sharp(
        contenido,
        {
          failOn:
            'warning',
        },
      ).metadata();
  } catch {
    throw new BadRequestException(
      'No se pudo interpretar la imagen panorámica.',
    );
  }

  const formato =
    metadatos.format;

  if (
    formato !== 'jpeg' &&
    formato !== 'png' &&
    formato !== 'webp'
  ) {
    throw new UnsupportedMediaTypeException(
      'Solo se permiten panorámicas JPG, JPEG, PNG y WebP.',
    );
  }

  let fotogramas =
    metadatos.pages ??
    1;

  if (
    formato === 'png'
  ) {
    try {
      fotogramas =
        Math.max(
          fotogramas,
          leerFotogramasPng(
            contenido,
          ),
        );
    } catch {
      throw new BadRequestException(
        'No se pudo interpretar la imagen panorámica.',
      );
    }
  }

  if (
    !Number.isSafeInteger(
      fotogramas,
    ) ||
    fotogramas < 1
  ) {
    throw new BadRequestException(
      'La imagen panorámica contiene metadatos inválidos.',
    );
  }

  if (
    fotogramas > 1
  ) {
    throw new BadRequestException(
      'Solo se aceptan imágenes panorámicas estáticas.',
    );
  }

  const anchoOriginal =
    metadatos.width;

  const altoOriginal =
    metadatos.height;

  if (
    typeof anchoOriginal !==
      'number' ||
    typeof altoOriginal !==
      'number' ||
    !Number.isSafeInteger(
      anchoOriginal,
    ) ||
    !Number.isSafeInteger(
      altoOriginal,
    ) ||
    anchoOriginal < 1 ||
    altoOriginal < 1
  ) {
    throw new BadRequestException(
      'La imagen panorámica no contiene dimensiones válidas.',
    );
  }

  /*
   * Las orientaciones EXIF 5–8 intercambian los ejes.
   * Solo interpretamos las dimensiones; no rotamos el archivo.
   */
  const intercambiaEjes =
    [5, 6, 7, 8].includes(
      metadatos.orientation ??
        1,
    );

  const ancho =
    intercambiaEjes
      ? altoOriginal
      : anchoOriginal;

  const alto =
    intercambiaEjes
      ? anchoOriginal
      : altoOriginal;

  if (
    ancho <
      ANCHO_MINIMO ||
    alto <
      ALTO_MINIMO
  ) {
    throw new BadRequestException(
      `La panorámica debe tener al menos ${ANCHO_MINIMO} × ${ALTO_MINIMO} píxeles.`,
    );
  }

  const proporcion =
    ancho / alto;

  const proporcionDosAUno =
    proporcion >=
      PROPORCION_MINIMA &&
    proporcion <=
      PROPORCION_MAXIMA;

  if (
    !proporcionDosAUno
  ) {
    throw new BadRequestException(
      'La imagen no es compatible con el visor 360°. Debe ser una panorámica equirectangular con proporción aproximada 2:1.',
    );
  }

  /*
   * metadata() solo lee encabezados.
   * stats() fuerza la decodificación para detectar errores del contenido,
   * sin generar otro archivo ni devolver un Buffer de píxeles.
   */
  const lector =
    sharp(
      contenido,
      {
        failOn:
          'warning',
      },
    );

  try {
    await lector
      .timeout({
        seconds:
          30,
      })
      .stats();
  } catch {
    throw new BadRequestException(
      'No se pudo decodificar la imagen panorámica dentro de los límites de procesamiento.',
    );
  } finally {
    lector.destroy();
  }

  const mimeType:
    MimePanoramica =
      formato === 'jpeg'
        ? 'image/jpeg'
        : formato ===
            'png'
          ? 'image/png'
          : 'image/webp';

  return {
    formato,

    mimeType,

    bytes:
      contenido.length,

    ancho,

    alto,

    proporcionDosAUno,
  };
}