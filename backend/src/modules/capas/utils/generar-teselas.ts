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
  if (motor === 'gdal') estimarTeselas(bbox, config);
  const temporal = await crearTemporalCapa(
  'teselas',
  raizTemporal,
);
  try {
    const salida = join(temporal, 'resultado');
    if (motor === 'python') {
      await ejecutarRasterio(rutaOriginal, salida, config);
    } else {
      const argumentos = construirArgumentosTeselas(rutaOriginal, salida, config);
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
    const teselas = await verificarTeselas(salida, config);
    return await operacion({
      teselas, total: teselas.length,
      zoomMin: config.zoomMin, zoomMax: config.zoomMax, tamano: 256,
    });
  } finally {
    await rm(temporal, { recursive: true, force: true });
  }
}
