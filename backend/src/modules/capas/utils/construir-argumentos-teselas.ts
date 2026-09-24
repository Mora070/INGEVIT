import { isAbsolute, resolve, relative, sep } from 'node:path';

import type { TeselasConfig } from '../config/teselas.config';

/**
 * Construye argumentos separados para ejecutar GDAL sin shell.
 *
 * Las rutas son internas y el destino debe ser una carpeta exclusiva
 * de la generación. El ejecutor comprobará su estado antes de escribir.
 *
 * No publica archivos ni modifica la base de datos.
 */
export function construirArgumentosTeselas(
  rutaOriginal: string,
  directorioSalida: string,
  config: TeselasConfig,
): string[] {
  for (const ruta of [rutaOriginal, directorioSalida]) {
    if (
      typeof ruta !== 'string'
      || !isAbsolute(ruta)
      || /[\u0000\r\n]/.test(ruta)
    ) {
      throw new Error('Las rutas del procesamiento deben ser absolutas y válidas.');
    }
  }

  const entrada = resolve(rutaOriginal);
  const salida = resolve(directorioSalida);

  /*
   * El original no puede quedar dentro de la carpeta que posteriormente
   * se publicará o eliminará como resultado del procesamiento.
   */
  const desdeSalida = relative(salida, entrada);

  if (
    desdeSalida === ''
    || (
      !isAbsolute(desdeSalida)
      && desdeSalida !== '..'
      && !desdeSalida.startsWith(`..${sep}`)
    )
  ) {
    throw new Error(
      'El original debe permanecer fuera del directorio de teselas.',
    );
  }

  return [
    'raster',
    'tile',

    '--input-format', 'GTiff',
    '--open-option', 'GEOREF_SOURCES=INTERNAL',

    '--output-format', 'PNG',
    '--tiling-scheme', 'WebMercatorQuad',
    '--convention', 'xyz',
    '--tile-size', '256',

    '--min-zoom', String(config.zoomMin),
    '--max-zoom', String(config.zoomMax),

    '--resampling', 'bilinear',
    '--overview-resampling', 'average',
    '--add-alpha',

    /*
     * Usamos hilos del mismo proceso para que el control de tiempo
     * no dependa de finalizar un árbol de procesos secundarios.
     */
    '--num-threads', String(config.hilos),
    '--parallel-method', 'thread',

    // El visor será el frontend de INGEVIT.
    '--webviewer', 'none',

    '--input', entrada,
    '--output', salida,
  ];
}