import type {
  PanoramicaResponse,
  PanoramicaRow,
} from '../types/panoramica.types';

/**
 * Convierte una coordenada numeric de PostgreSQL a número.
 *
 * Rechaza columnas omitidas, valores vacíos y datos fuera de rango.
 * Un error de consulta nunca debe convertirse en una ubicación ficticia.
 */
function convertirCoordenada(
  valor: unknown,
  limite: number,
): number {
  if (
    typeof valor !== 'string'
    || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(valor)
  ) {
    throw new Error(
      'La ubicación de la panorámica tiene un formato inesperado.',
    );
  }

  const numero = Number(valor);

  if (!Number.isFinite(numero) || Math.abs(numero) > limite) {
    throw new Error(
      'La ubicación de la panorámica está fuera del rango permitido.',
    );
  }

  return numero;
}

/**
 * Selecciona explícitamente los campos públicos.
 *
 * Conserva ambas coordenadas en null para panorámicas antiguas
 * sin ubicación. Las ubicadas requieren la pareja completa.
 *
 * No modifica el registro ni expone la clave de almacenamiento.
 */
export function mapearPanoramica(
  panoramica: PanoramicaRow,
): PanoramicaResponse {
  let latitud: number | null;
  let longitud: number | null;

  if (panoramica.latitud === null && panoramica.longitud === null) {
    latitud = null;
    longitud = null;
  } else {
    latitud = convertirCoordenada(panoramica.latitud, 90);
    longitud = convertirCoordenada(panoramica.longitud, 180);
  }

  return {
    id_panoramica: panoramica.id_panoramica,
    id_proyecto: panoramica.id_proyecto,
    id_usuario_subida: panoramica.id_usuario_subida,
    titulo: panoramica.titulo,
    url: panoramica.url,
    mime_type: panoramica.mime_type,
    latitud,
    longitud,
    fecha_subida: panoramica.fecha_subida.toISOString(),
  };
}