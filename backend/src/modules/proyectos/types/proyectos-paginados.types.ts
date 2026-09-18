import type { ProyectoResponse } from './proyecto.types';

/**
 * Resultado del listado de proyectos.
 *
 * total cuenta únicamente los proyectos accesibles para
 * el usuario autenticado, nunca los proyectos de todo el sistema.
 */
export interface ProyectosPaginadosResponse {
  proyectos: ProyectoResponse[];
  pagina: number;
  limite: number;
  total: number;
  total_paginas: number;
}