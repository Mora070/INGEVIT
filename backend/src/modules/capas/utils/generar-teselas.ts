import { Logger, UnprocessableEntityException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { rm } from 'node:fs/promises';
import { crearTemporalCapa } from './crear-temporal-capa';
import { join } from 'node:path';
import { getGdalConfig } from '../config/gdal.config';
import { getTeselasConfig } from '../config/teselas.config';
import type { GdalConfig } from '../config/gdal.config';
import type { TeselasConfig } from '../config/teselas.config';
import { construirArgumentosTeselas } from './construir-argumentos-teselas';
import { estimarTeselas } from './estimar-teselas';
import { verificarTeselas } from './verificar-teselas';
import type { TeselaVerificada } from './verificar-teselas';
import { ejecutarRasterio, getRasterioConfig } from './ejecutar-rasterio';

const ejecutar = promisify(execFile);
const logger = new Logger('GeneracionTeselas');

export interface GeneracionTeselas {
  teselas: TeselaVerificada[];
  total: number;
  zoomMin: number;
  zoomMax: number;
  tamano: 256;
}

/** Valida el motor antes de que el trabajador tome una capa. */
export function validarMotorTeselas(): 'gdal' | 'python' {
  const motor = process.env.CAPAS_TESELAS_MOTOR ?? 'gdal';
  if (motor !== 'gdal' && motor !== 'python') {
    throw new Error('CAPAS_TESELAS_MOTOR debe ser gdal o python.');
  }
  if (motor === 'python') getRasterioConfig();
  return motor;
}

/**
 * Genera una colección provisional y valida sus PNG antes de publicarla.
 * El callback debe terminar todas sus copias antes de devolver el control.
 * Ningún motor escribe en carpetas públicas ni modifica PostgreSQL.
 */
export async function conTeselasGeneradas<T>(
  rutaOriginal: string,
  bbox: readonly [number, number, number, number],
  operacion: (generacion: GeneracionTeselas) => Promise<T>,
  config: TeselasConfig = getTeselasConfig(),
  gdal: GdalConfig = getGdalConfig(),
  raizTemporal?: string,
): Promise<T> {
  const motor = validarMotorTeselas();
  // Python calcula su propia extensión densificada y el número de teselas.
  let configEfectiva = motor === 'gdal'
    ? seleccionarZoomGdal(bbox, config)
    : { ...config };
  const temporal = await crearTemporalCapa(
  'teselas',
  raizTemporal,
);
  try {
    const salida = join(temporal, 'resultado');
    if (motor === 'python') {
      const zoomMax = await ejecutarRasterio(rutaOriginal, salida, config);
      configEfectiva = { ...config, zoomMax };
    } else {
      const argumentos = construirArgumentosTeselas(rutaOriginal, salida, configEfectiva);
      try {
        await ejecutar(config.ejecutable, argumentos, {
          encoding: 'utf8', shell: false, windowsHide: true,
          timeout: config.timeoutMs, maxBuffer: 4 * 1024 * 1024,
          env: {
            ...process.env,
            GDAL_DATA: gdal.directorioDatosGdal,
            PROJ_DATA: gdal.directorioDatosProj,
            PROJ_NETWORK: 'OFF', GDAL_PAM_ENABLED: 'NO',
            GDAL_DISABLE_READDIR_ON_OPEN: 'EMPTY_DIR',
          },
        });
      } catch (cause: unknown) {
        throw new Error('GDAL no pudo completar la generación de teselas.', { cause });
      }
    }
    if (configEfectiva.zoomMax < config.zoomMax) {
      logger.log(`Zoom ajustado de ${config.zoomMax} a ${configEfectiva.zoomMax} para respetar el límite de ${config.maxArchivos} teselas.`);
    }
    const teselas = await verificarTeselas(salida, configEfectiva);
    return await operacion({
      teselas, total: teselas.length,
      zoomMin: configEfectiva.zoomMin, zoomMax: configEfectiva.zoomMax, tamano: 256,
    });
  } finally {
    await rm(temporal, { recursive: true, force: true });
  }
}

/** Solo reduce el zoom por exceso de teselas; otros errores se conservan. */
export function seleccionarZoomGdal(
  bbox: readonly [number, number, number, number],
  config: TeselasConfig,
): TeselasConfig {
  for (let zoomMax = config.zoomMax; zoomMax >= config.zoomMin; zoomMax -= 1) {
    const candidata = { ...config, zoomMax };
    try {
      estimarTeselas(bbox, candidata);
      return candidata;
    } catch (error: unknown) {
      if (!(error instanceof UnprocessableEntityException)
          || error.message !== 'El área y los niveles de zoom superan el máximo de teselas configurado.') {
        throw error;
      }
      if (zoomMax === config.zoomMin) {
        throw new UnprocessableEntityException(
          'Incluso el zoom mínimo supera el presupuesto de teselas.',
        );
      }
    }
  }
  throw new Error('La configuración de zoom no es válida.');
}
