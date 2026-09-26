import type {
  FotografiaResponse,
  FotografiaRow,
} from '../types/fotografia.types';

/**
 * Convierte un numeric de PostgreSQL a un número público.
 *
 * Una columna omitida, un texto vacío o un valor fuera del rango
 * representan un error interno de datos o de consulta.
 * No deben convertirse silenciosamente en cero ni en null.
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
      'La ubicación de la fotografía tiene un formato inesperado.',
    );
  }

  const numero = Number(valor);

  if (
    !Number.isFinite(numero)
    || Math.abs(numero) > limite
  ) {
    throw new Error(
      'La ubicación de la fotografía está fuera del rango permitido.',
    );
  }

  return numero;
}

/**
 * Construye la representación pública sin exponer claves de almacenamiento.
 *
 * Las fotografías antiguas pueden conservar ambas coordenadas en null.
 * Las fotografías ubicadas deben proporcionar la pareja completa.
 * No modifica el registro recibido ni comprueba permisos.
 */
export function mapearFotografia(
  fotografia: FotografiaRow,
): FotografiaResponse {
  let latitud: number | null;
  let longitud: number | null;

  if (
    fotografia.latitud === null
    && fotografia.longitud === null
  ) {
    latitud = null;
    longitud = null;
  } else {
    latitud = convertirCoordenada(
      fotografia.latitud,
      90,
    );

    longitud = convertirCoordenada(
      fotografia.longitud,
      180,
    );
  }

  return {
    id_fotografia:
      fotografia.id_fotografia,

    id_proyecto:
      fotografia.id_proyecto,

    id_usuario_subida:
      fotografia.id_usuario_subida,

    titulo:
      fotografia.titulo,

    url:
      fotografia.url,

    latitud,
    longitud,

    fecha_subida:
      fotografia.fecha_subida.toISOString(),

    es_portada:
      fotografia.es_portada,
  };
}