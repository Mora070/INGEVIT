import type { PlanoResponse, PlanoRow } from './plano.types';

export interface PlanosPaginadosResponse {
  planos: PlanoResponse[];
  pagina: number;
  limite: number;
  total: number;
  total_paginas: number;
}

/**
 * null representa un proyecto no disponible.
 * Una colección vacía representa una página sin resultados.
 */
export type ResultadoConsultaPlanos = {
  planos: PlanoRow[];
  total: number;
} | null;