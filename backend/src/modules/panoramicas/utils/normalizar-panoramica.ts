
import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';

import sharp from 'sharp';

import {
  MAX_BYTES_PANORAMICA,
} from '../config/subida-panoramica.config';

import {
  inspeccionarPanoramica,
} from './inspeccionar-panoramica';

const PROPORCION_MINIMA = 1.85;
const PROPORCION_MAXIMA = 2.15;

export interface PanoramicaNormalizada {
  contenido: Buffer;
  formato: 'jpeg' | 'png' | 'webp';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  ancho: number;
  alto: number;
  normalizada: boolean;
}

export async function normalizarPanoramica(
  contenido: Buffer,
): Promise<PanoramicaNormalizada> {
  const inspeccion = await inspeccionarPanoramica(
    contenido,
  );

  const {
    ancho,
    alto,
    formato,
    mimeType,
  } = inspeccion;

  const proporcion = ancho / alto;

  if (
    proporcion < PROPORCION_MINIMA ||
    proporcion > PROPORCION_MAXIMA
  ) {
    throw new BadRequestException(
      'La imagen debe tener una proporción cercana a 2:1 para utilizarse como panorámica 360°.',
    );
  }

  if (ancho === alto * 2) {
    return {
      contenido,
      formato,
      mimeType,
      ancho,
      alto,
      normalizada: false,
    };
  }

  const anchoFinal = Math.max(
    ancho,
    alto * 2,
  );

  const altoFinal = anchoFinal / 2;

  if (!Number.isSafeInteger(altoFinal)) {
    throw new BadRequestException(
      'No fue posible calcular las dimensiones de la panorámica.',
    );
  }

  const izquierda = Math.floor(
    (anchoFinal - ancho) / 2,
  );

  const derecha =
    anchoFinal - ancho - izquierda;

  const arriba = Math.floor(
    (altoFinal - alto) / 2,
  );

  const abajo =
    altoFinal - alto - arriba;

  let procesador = sharp(contenido)
    .rotate()
    .extend({
      top: arriba,
      bottom: abajo,
      left: izquierda,
      right: derecha,
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 1,
      },
    });

  if (formato === 'jpeg') {
    procesador = procesador.jpeg({
      quality: 90,
      mozjpeg: true,
    });
  } else if (formato === 'png') {
    procesador = procesador.png();
  } else {
    procesador = procesador.webp({
      quality: 90,
    });
  }

  let resultado: Buffer;

  try {
    resultado = await procesador.toBuffer();
  } catch {
    throw new BadRequestException(
      'No fue posible normalizar la panorámica 360°.',
    );
  }

  if (resultado.length > MAX_BYTES_PANORAMICA) {
    throw new PayloadTooLargeException(
      'La panorámica normalizada supera el límite de 50 MB.',
    );
  }

  const verificacion = await inspeccionarPanoramica(
    resultado,
  );

  if (
    verificacion.ancho !==
      verificacion.alto * 2
  ) {
    throw new BadRequestException(
      'La panorámica normalizada no tiene proporción 2:1.',
    );
  }

  return {
    contenido: resultado,
    formato: verificacion.formato,
    mimeType: verificacion.mimeType,
    ancho: verificacion.ancho,
    alto: verificacion.alto,
    normalizada: true,
  };
}
