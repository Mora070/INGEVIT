import {
  BadGatewayException,
  GatewayTimeoutException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { execFile } from 'node:child_process';
import type {
  ExecFileOptionsWithStringEncoding,
} from 'node:child_process';
import { isAbsolute } from 'node:path';

import {
  getGdalConfig,
} from '../config/gdal.config';
import type {
  GdalConfig,
} from '../config/gdal.config';

/**
 * Permite sustituir exclusivamente la ejecución del proceso en las pruebas.
 * Esta dependencia nunca procede de una petición HTTP.
 */
export type EjecutorGdalInfo = (
  ejecutable: string,
  argumentos: string[],
  opciones: ExecFileOptionsWithStringEncoding,
) => Promise<string>;

const ejecutarProceso: EjecutorGdalInfo = (
  ejecutable,
  argumentos,
  opciones,
) => new Promise((resolve, reject) => {
  execFile(ejecutable, argumentos, opciones, (error, stdout) => {
    if (error) {
      reject(error);
      return;
    }

    resolve(stdout);
  });
});

/**
 * Obtiene información del archivo temporal mediante GDAL.
 *
 * No usa shell ni interpreta el nombre original como un argumento.
 * No devuelve stderr, comandos o rutas dentro de los errores HTTP.
 *
 * La salida sigue siendo información sin validar:
 * otro componente comprobará CRS, dimensiones y extensión geográfica.
 */
export async function ejecutarGdalInfo(
  rutaTemporal: string,
  configuracion: GdalConfig = getGdalConfig(),
  ejecutor: EjecutorGdalInfo = ejecutarProceso,
): Promise<Record<string, unknown>> {
  if (
    typeof rutaTemporal !== 'string'
    || !isAbsolute(rutaTemporal)
    || /[\u0000\r\n]/.test(rutaTemporal)
  ) {
    throw new Error('La ruta temporal de GDAL no es válida.');
  }

  const argumentos = [
    '-json',
    '-nomd',
    '-norat',
    '-noct',
    '-if',
    'GTiff',
    '-oo',
    'GEOREF_SOURCES=INTERNAL',
    rutaTemporal,
  ];

  let salida: string;

  try {
    salida = await ejecutor(
      configuracion.ejecutableInfo,
      argumentos,
      {
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
        timeout: configuracion.timeoutInfoMs,

        // Límite de metadatos, independiente del tamaño del GeoTIFF.
        maxBuffer: 4 * 1024 * 1024,

        env: {
          ...process.env,
          GDAL_DATA: configuracion.directorioDatosGdal,
          PROJ_DATA: configuracion.directorioDatosProj,

          // No descargar recursos de transformación durante la inspección.
          PROJ_NETWORK: 'OFF',

          // No crear archivos auxiliares de metadatos.
          GDAL_PAM_ENABLED: 'NO',

          // El temporal se inspecciona sin buscar archivos vecinos.
          GDAL_DISABLE_READDIR_ON_OPEN: 'EMPTY_DIR',
        },
      },
    );
  } catch (error: unknown) {
    const detalle = (
      typeof error === 'object' && error !== null
    ) ? error as Record<string, unknown> : {};

    if (detalle.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      throw new UnprocessableEntityException(
        'Los metadatos del archivo superan el límite de inspección.',
      );
    }

    if (detalle.killed === true) {
      throw new GatewayTimeoutException(
        'La inspección del GeoTIFF excedió el tiempo disponible.',
      );
    }

    if (typeof detalle.code === 'number') {
      throw new UnprocessableEntityException(
        'No fue posible inspeccionar el archivo como GeoTIFF.',
      );
    }

    throw new ServiceUnavailableException(
      'El servicio de inspección geográfica no está disponible.',
    );
  }

  let informacion: unknown;

  try {
    informacion = JSON.parse(salida);
  } catch {
    throw new BadGatewayException(
      'El servicio geográfico devolvió una respuesta inválida.',
    );
  }

  if (
    typeof informacion !== 'object'
    || informacion === null
    || Array.isArray(informacion)
  ) {
    throw new BadGatewayException(
      'El servicio geográfico devolvió una respuesta inválida.',
    );
  }

  return informacion as Record<string, unknown>;
}