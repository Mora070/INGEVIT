import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isAbsolute } from 'node:path';
import { Logger } from '@nestjs/common';
import type { TeselasConfig } from '../config/teselas.config';

const ejecutar = promisify(execFile);
const logger = new Logger('Rasterio');

/** Configuración interna: ninguna ruta se recibe del formulario. */
export function getRasterioConfig(env: NodeJS.ProcessEnv = process.env) {
  function ruta(nombre: string): string {
    const valor = env[nombre];
    if (!valor || valor !== valor.trim() || /[\u0000\r\n]/.test(valor) || !isAbsolute(valor)) {
      throw new Error(`${nombre} debe ser una ruta absoluta válida.`);
    }
    return valor;
  }
  function entero(nombre: string, defecto: string, maximo: number): number {
    const valor = env[nombre] ?? defecto;
    const numero = Number(valor);
    if (!/^[1-9][0-9]*$/.test(valor) || !Number.isSafeInteger(numero) || numero > maximo) {
      throw new Error(`${nombre} debe ser un entero positivo hasta ${maximo}.`);
    }
    return numero;
  }
  return {
    python: ruta('CAPAS_PYTHON_PATH'),
    script: ruta('CAPAS_RASTERIO_SCRIPT'),
    cacheMb: entero('CAPAS_RASTERIO_CACHE_MB', '256', 4096),
    warpMb: entero('CAPAS_RASTERIO_WARP_MB', '64', 4096),
    maxBytes: entero('CAPAS_TESELAS_MAX_BYTES', '10737418240', Number.MAX_SAFE_INTEGER),
  };
}

/** Ejecuta Python aislado, sin shell y sin importar datos PROJ de OSGeo4W. */
export async function ejecutarRasterio(
  original: string,
  salida: string,
  config: TeselasConfig,
): Promise<void> {
  const rasterio = getRasterioConfig();
  if (config.zoomMax > 24) {
    throw new Error('El procesador Rasterio admite hasta zoom 24.');
  }
  const env = { ...process.env };
  for (const nombre of Object.keys(env)) {
    if (/^(GDAL_|PROJ_|PYTHON)/i.test(nombre)) delete env[nombre];
  }
  try {
    await ejecutar(rasterio.python, [
      '-I', '-u', rasterio.script,
      '--input', original, '--output', salida,
      '--minzoom', String(config.zoomMin), '--maxzoom', String(config.zoomMax),
      '--max-tiles', String(config.maxArchivos),
      '--max-bytes', String(rasterio.maxBytes),
      '--cache-mb', String(rasterio.cacheMb), '--warp-mb', String(rasterio.warpMb),
    ], {
      env, encoding: 'utf8', shell: false, windowsHide: true,
      timeout: config.timeoutMs, maxBuffer: 4 * 1024 * 1024,
    });
  } catch (cause: unknown) {
    const mensajes: Record<string, string> = {
      LIMITE_TESELAS: 'El área y los zoom superan el presupuesto de teselas.',
      LIMITE_DISCO: 'Las teselas superan el presupuesto de almacenamiento.',
      TIPO_DATO: 'El GeoTIFF necesita una política de conversión a Byte.',
      BANDAS: 'No se identificaron bandas RGB o grises.',
      GEOREFERENCIA: 'La georreferenciación no es afín o no es válida.',
      EXTENSION: 'La extensión no es compatible con Web Mercator.',
    };
    let mensaje = 'Python no pudo completar la generación de teselas.';
    if (cause && typeof cause === 'object') {
      if ('killed' in cause && cause.killed === true) {
        mensaje = 'El procesamiento Python agotó el tiempo permitido.';
      } else if ('stderr' in cause && typeof cause.stderr === 'string') {
        try {
          const ultimo = cause.stderr.trim().split(/\r?\n/).at(-1) ?? '';
          const detalle: unknown = JSON.parse(ultimo);
          if (detalle && typeof detalle === 'object' && 'codigo' in detalle
              && typeof detalle.codigo === 'string'
              && Object.hasOwn(mensajes, detalle.codigo)) {
            mensaje = mensajes[detalle.codigo]!;
          }
        } catch { /* Solo se registran mensajes internos conocidos. */ }
      }
    }
    logger.warn(mensaje);
    throw new Error(mensaje, { cause });
  }
}
