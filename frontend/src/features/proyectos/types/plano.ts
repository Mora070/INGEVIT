export interface PlanoProyecto {
  id_plano: string;

  id_proyecto: string;

  id_usuario_subida: string;

  titulo: string;

  descripcion: string;

  url: string;

  mime_type: 'application/pdf';

  fecha_subida: string;
}

export interface PlanosPaginados {
  planos: PlanoProyecto[];

  pagina: number;

  limite: number;

  total: number;

  total_paginas: number;
}