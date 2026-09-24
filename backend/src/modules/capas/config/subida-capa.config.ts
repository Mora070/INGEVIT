/**
 * Configuración operativa de la recepción de GeoTIFF.
 *
 * El tamaño se expresa en bytes y se configura por entorno.
 * No representa un límite definitivo del producto.
 *
 * Sin configuración, la futura ruta de subida permanecerá deshabilitada.
 * La consulta y configuración de capas podrán seguir funcionando.
 */
export type SubidaCapaConfig =
  | {
      habilitada: false;
      maxArchivoBytes: null;
    }
  | {
      habilitada: true;
      maxArchivoBytes: number;
    };

/**
 * Lee únicamente la configuración; no crea archivos ni abre conexiones.
 *
 * Rechaza valores ambiguos para evitar interpretar incorrectamente
 * un límite que protege el espacio de almacenamiento del servidor.
 */
export function getSubidaCapaConfig(
  env: NodeJS.ProcessEnv = process.env,
): SubidaCapaConfig {
  const valor = env.CAPAS_MAX_ARCHIVO_BYTES;

  if (valor === undefined) {
    return {
      habilitada: false,
      maxArchivoBytes: null,
    };
  }

  if (
    typeof valor !== 'string'
    || valor !== valor.trim()
    || !/^[1-9][0-9]*$/.test(valor)
  ) {
    throw new Error(
      'CAPAS_MAX_ARCHIVO_BYTES debe ser un entero positivo expresado en bytes.',
    );
  }

  const maxArchivoBytes = Number(valor);

  /*
   * Reservamos un entero adicional para que la recepción pueda detectar
   * el primer byte que exceda el límite sin perder precisión numérica.
   *
   * Este es un límite técnico de representación, no del producto.
   */
  if (
    !Number.isSafeInteger(maxArchivoBytes)
    || maxArchivoBytes >= Number.MAX_SAFE_INTEGER
  ) {
    throw new Error(
      'CAPAS_MAX_ARCHIVO_BYTES excede el rango técnico permitido.',
    );
  }

  return {
    habilitada: true,
    maxArchivoBytes,
  };
}