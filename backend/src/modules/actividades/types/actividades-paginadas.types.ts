import type { ActividadResponse } from './actividad.types';

/**
 * Respuesta pública de una página del historial de un proyecto.
 *
 * Los metadatos permiten al frontend construir la navegación sin
 * descargar todas las actividades.
 */
export interface ActividadesPaginadasResponse {
  /** Actividades incluidas en la página solicitada. */
  actividades: ActividadResponse[];

  /** Número de página solicitado. La primera página es 1. */
  pagina: number;

  /** Cantidad máxima de actividades por página. */
  limite: number;

  /** Cantidad total de actividades del proyecto consultado. */
  total: number;

  /** Cantidad de páginas calculada a partir del total y el límite. */
  total_paginas: number;
}