export interface FotografiaProyecto {
  id_fotografia: string;
  id_proyecto: string;
  id_usuario_subida: string;

  titulo: string;
  url: string;

  fecha_subida: string;

  latitud: number | null;
  longitud: number | null;

  es_portada: boolean;
}

export interface FotografiasPaginadas {
  fotografias: FotografiaProyecto[];

  pagina: number;
  limite: number;

  total: number;
  total_paginas: number;
}