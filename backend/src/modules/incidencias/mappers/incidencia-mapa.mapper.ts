import type {
  IncidenciaMapaRow,
} from '../incidencias.repository';

/**
 * Convierte una coordenada numeric de PostgreSQL.
 *
 * No acepta valores ausentes, vacíos, infinitos o fuera de rango.
 * Una consulta incompleta debe producir un error interno,
 * nunca una ubicación inventada.
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
      'La incidencia de mapa contiene una ubicación inválida.',
    );
  }

  const numero =
    Number(valor);

  if (
    !Number.isFinite(numero)
    || Math.abs(numero) > limite
  ) {
    throw new Error(
      'La incidencia de mapa contiene una ubicación inválida.',
    );
  }

  return numero;
}

/**
 * Construye la respuesta pública de una incidencia creada en el mapa.
 *
 * Selecciona explícitamente los campos públicos.
 *
 * Una incidencia de mapa puede ser:
 *
 * - Texto:
 *   id_fotografia = null
 *   id_panoramica = null
 *
 * - Fotografía:
 *   id_fotografia != null
 *   id_panoramica = null
 *
 * - Panorámica:
 *   id_fotografia = null
 *   id_panoramica != null
 *
 * La base de datos impide que ambos recursos
 * estén relacionados simultáneamente.
 */
export function mapearIncidenciaMapa(
  incidencia: IncidenciaMapaRow,
) {
  if (
    incidencia.id_plano !== null
    || incidencia.numero_pagina !== null
    || incidencia.coordenada_x !== null
    || incidencia.coordenada_y !== null
  ) {
    throw new Error(
      'La incidencia de mapa contiene un contexto de plano inesperado.',
    );
  }

  if (
    incidencia.id_fotografia !== null
    && incidencia.id_panoramica !== null
  ) {
    throw new Error(
      'La incidencia de mapa contiene más de un recurso multimedia.',
    );
  }

  const latitud =
    convertirCoordenada(
      incidencia.latitud,
      90,
    );

  const longitud =
    convertirCoordenada(
      incidencia.longitud,
      180,
    );

  return {
    id_incidencia:
      incidencia.id_incidencia,

    id_proyecto:
      incidencia.id_proyecto,

    id_plano:
      incidencia.id_plano,

    id_creador:
      incidencia.id_creador,

    titulo:
      incidencia.titulo,

    descripcion:
      incidencia.descripcion,

    estado:
      incidencia.estado,

    prioridad:
      incidencia.prioridad,

    numero_pagina:
      incidencia.numero_pagina,

    coordenada_x:
      incidencia.coordenada_x,

    coordenada_y:
      incidencia.coordenada_y,

    latitud,

    longitud,

    id_fotografia:
      incidencia.id_fotografia,

    id_panoramica:
      incidencia.id_panoramica,

    fecha_creacion:
      incidencia.fecha_creacion.toISOString(),
  };
}

export type IncidenciaMapaResponse =
  ReturnType<
    typeof mapearIncidenciaMapa
  >;