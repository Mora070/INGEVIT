import type {
  ProyectoListadoResponse,
} from './proyecto-listado.types';

/**
 * Resultado del listado de proyectos.
 *
 * total cuenta únicamente los proyectos accesibles para
 * el usuario autenticado, nunca los proyectos de todo el sistema.
 */
export interface ProyectosPaginadosResponse {
  proyectos: ProyectoListadoResponse[];
  pagina: number;
  limite: number;
  total: number;
  total_paginas: number;
}