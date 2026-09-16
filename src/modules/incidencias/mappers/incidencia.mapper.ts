import type { IncidenciaRow } from '../incidencias.repository';

/**
 * Selecciona los campos públicos y adapta los tipos de PostgreSQL
 * al contrato JSON.
 */
export function mapearIncidencia(incidencia: IncidenciaRow) {
  const coordenadaX = Number(incidencia.coordenada_x);
  const coordenadaY = Number(incidencia.coordenada_y);

  if (
    incidencia.coordenada_x.trim() === '' ||
    incidencia.coordenada_y.trim() === '' ||
    !Number.isFinite(coordenadaX) ||
    !Number.isFinite(coordenadaY)
  ) {
    throw new Error('La incidencia contiene coordenadas inválidas.');
  }

  return {
    id_incidencia: incidencia.id_incidencia,
    id_proyecto: incidencia.id_proyecto,
    id_plano: incidencia.id_plano,
    id_creador: incidencia.id_creador,
    titulo: incidencia.titulo,
    descripcion: incidencia.descripcion,
    estado: incidencia.estado,
    prioridad: incidencia.prioridad,
    numero_pagina: incidencia.numero_pagina,
    coordenada_x: coordenadaX,
    coordenada_y: coordenadaY,
    fecha_creacion: incidencia.fecha_creacion.toISOString(),
  };
}

export type IncidenciaResponse = ReturnType<typeof mapearIncidencia>;