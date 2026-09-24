import { isAbsolute, normalize } from 'node:path';

export interface TeselasConfig {
  ejecutable: string;
  zoomMin: number;
  zoomMax: number;
  hilos: number;
  timeoutMs: number;
  maxArchivos: number;
}

/**
 * Configuración del procesamiento, independiente de la recepción HTTP.
 *
 * Los niveles de zoom son explícitos para evitar que GDAL seleccione
 * automáticamente un volumen de trabajo diferente al configurado.
 */
export function getTeselasConfig(
  env: NodeJS.ProcessEnv = process.env,
): TeselasConfig {
  const ejecutable = env.CAPAS_GDAL_PATH;

  if (
    typeof ejecutable !== 'string'
    || ejecutable === ''
    || ejecutable !== ejecutable.trim()
    || /[\u0000\r\n]/.test(ejecutable)
    || !isAbsolute(ejecutable)
  ) {
    throw new Error(
      'CAPAS_GDAL_PATH debe contener una ruta absoluta válida.',
    );
  }

  const zoomMin = entero(
    env.CAPAS_TESELAS_ZOOM_MIN,
    'CAPAS_TESELAS_ZOOM_MIN',
    0,
    30,
  );

  const zoomMax = entero(
    env.CAPAS_TESELAS_ZOOM_MAX,
    'CAPAS_TESELAS_ZOOM_MAX',
    0,
    30,
  );

  if (zoomMin > zoomMax) {
    throw new Error(
      'CAPAS_TESELAS_ZOOM_MIN no puede superar CAPAS_TESELAS_ZOOM_MAX.',
    );
  }

  return {
    ejecutable: normalize(ejecutable),
    zoomMin,
    zoomMax,
    hilos: entero(
      env.CAPAS_TESELAS_HILOS,
      'CAPAS_TESELAS_HILOS',
      1,
      16,
    ),
    timeoutMs: entero(
      env.CAPAS_TESELAS_TIMEOUT_MS,
      'CAPAS_TESELAS_TIMEOUT_MS',
      1,
      2147483647,
    ),

    maxArchivos: entero(
      env.CAPAS_TESELAS_MAX_ARCHIVOS,
      'CAPAS_TESELAS_MAX_ARCHIVOS',
      1,
      Number.MAX_SAFE_INTEGER,
    ),
  };
}

function entero(
  valor: string | undefined,
  nombre: string,
  minimo: number,
  maximo: number,
): number {
  if (
    typeof valor !== 'string'
    || valor !== valor.trim()
    || !/^(0|[1-9][0-9]*)$/.test(valor)
  ) {
    throw new Error(`${nombre} debe ser un entero explícito.`);
  }

  const numero = Number(valor);

  if (
    !Number.isSafeInteger(numero)
    || numero < minimo
    || numero > maximo
  ) {
    throw new Error(
      `${nombre} debe estar entre ${minimo} y ${maximo}.`,
    );
  }

  return numero;
}