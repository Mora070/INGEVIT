import type { FotografiaResponse } from './fotografia.types';

/**
 * Respuesta pública de una página de fotografías del proyecto.
 *
 * Permite al frontend construir el mosaico y su navegación
 * sin descargar todos los metadatos en una sola petición.
 */
export interface FotografiasPaginadasResponse {
  /** Fotografías incluidas en la página solicitada. */
  fotografias: FotografiaResponse[];

  /** Número de página solicitado. La primera página es 1. */
  pagina: number;

  /** Cantidad máxima de fotografías devueltas por página. */
  limite: number;

  /** Cantidad total de fotografías del proyecto consultado. */
  total: number;

  /** Cantidad de páginas calculada a partir del total y el límite. */
  total_paginas: number;
}