import { UnprocessableEntityException } from '@nestjs/common';

import type { TeselasConfig } from '../config/teselas.config';

export const LATITUD_MAX_MERCATOR =
  Math.atan(Math.sinh(Math.PI)) * 180 / Math.PI;

type LimitesGeneracion = Pick<
  TeselasConfig,
  'zoomMin' | 'zoomMax' | 'maxArchivos'
>;

/**
 * Estima cuántas teselas cubren el bounding box en todos los zooms.
 *
 * Incluye un margen de una tesela alrededor de cada nivel para absorber
 * pequeñas diferencias en los límites y redondeos.
 *
 * Usa bigint para evitar desbordamientos en áreas o zooms grandes.
 * No enumera ni crea archivos.
 *
 * Es una comprobación previa, no una garantía del volumen final:
 * el ejecutor deberá controlar también la generación real.
 */
export function estimarTeselas(
  bbox: readonly [number, number, number, number],
  config: LimitesGeneracion,
): number {
  if (
    !Number.isInteger(config.zoomMin)
    || !Number.isInteger(config.zoomMax)
    || config.zoomMin < 0
    || config.zoomMax > 30
    || config.zoomMax < config.zoomMin
    || !Number.isSafeInteger(config.maxArchivos)
    || config.maxArchivos < 1
  ) {
    throw new Error('La configuración de estimación de teselas no es válida.');
  }

  if (
    !Array.isArray(bbox)
    || bbox.length !== 4
    || !bbox.every(
      (valor) => typeof valor === 'number' && Number.isFinite(valor),
    )
  ) {
    throw new UnprocessableEntityException(
      'La extensión geográfica de la capa no es válida.',
    );
  }

  const [oeste, sur, este, norte] = bbox;

  if (
    oeste < -180
    || este > 180
    || oeste >= este
    || sur >= norte
    || sur < -LATITUD_MAX_MERCATOR
    || norte > LATITUD_MAX_MERCATOR
  ) {
    throw new UnprocessableEntityException(
      'La extensión de la capa no es compatible con Web Mercator.',
    );
  }

  let total = 0n;
  const maximo = BigInt(config.maxArchivos);

  for (let zoom = config.zoomMin; zoom <= config.zoomMax; zoom += 1) {
    const lado = 2 ** zoom;

    const limitar = (indice: number) =>
      Math.max(0, Math.min(lado - 1, indice));

    const x = (longitud: number) =>
      Math.floor((longitud + 180) / 360 * lado);

    const y = (latitud: number) => {
      const radianes = latitud * Math.PI / 180;

      return Math.floor(
        (1 - Math.asinh(Math.tan(radianes)) / Math.PI) / 2 * lado,
      );
    };

    const xMin = limitar(x(oeste) - 1);
    const xMax = limitar(x(este) + 1);
    const yMin = limitar(y(norte) - 1);
    const yMax = limitar(y(sur) + 1);

    const columnas = BigInt(xMax - xMin + 1);
    const filas = BigInt(yMax - yMin + 1);

    total += columnas * filas;

    if (total > maximo) {
      throw new UnprocessableEntityException(
        'El área y los niveles de zoom superan el máximo de teselas configurado.',
      );
    }
  }

  // Es seguro: ya comprobamos que total no supera un entero seguro.
  return Number(total);
}