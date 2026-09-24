import type {
  CapaRow,
  TeselasCapaResponse,
} from '../types/capa.types';

/**
 * Valida el conjunto de metadatos de publicación.
 *
 * No comprueba la existencia física de las teselas:
 * esa responsabilidad corresponde al trabajador que las publica.
 */
export function mapearTeselasCapa(
  capa: CapaRow,
): TeselasCapaResponse | null {
  const valores = [
    capa.teselas_version,
    capa.teselas_proveedor,
    capa.teselas_zoom_min,
    capa.teselas_zoom_max,
    capa.teselas_tamano,
    capa.teselas_total,
  ];

  if (valores.every((valor) => valor === null)) {
    return null;
  }

  const version = capa.teselas_version;
  const zoomMin = capa.teselas_zoom_min;
  const zoomMax = capa.teselas_zoom_max;
  const total = capa.teselas_total;

  if (
    typeof version !== 'string'
    || version.length !== 36
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(version)
    || !['LOCAL', 'S3'].includes(capa.teselas_proveedor ?? '')
    || typeof zoomMin !== 'number'
    || !Number.isInteger(zoomMin)
    || zoomMin < 0
    || zoomMin > 2147483647
    || typeof zoomMax !== 'number'
    || !Number.isInteger(zoomMax)
    || zoomMax < zoomMin
    || zoomMax > 2147483647
    || capa.teselas_tamano !== 256
    || typeof total !== 'string'
    || total.trim() !== total
    || !/^[1-9][0-9]*$/.test(total)
    || BigInt(total) > 9223372036854775807n
  ) {
    throw new Error('La capa contiene metadatos de teselas inválidos.');
  }

  return {
    version,
    zoom_min: zoomMin,
    zoom_max: zoomMax,
    tamano: 256,
    total,
  };
}