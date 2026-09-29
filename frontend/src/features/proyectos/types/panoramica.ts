export type MimePanoramica =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

export interface PanoramicaProyecto {
  id_panoramica: string;

  id_proyecto: string;

  id_usuario_subida: string;

  titulo: string;

  url: string;

  mime_type: MimePanoramica;

  fecha_subida: string;

  latitud: number | null;

  longitud: number | null;
}

export interface PanoramicasPaginadas {
  panoramicas: PanoramicaProyecto[];

  pagina: number;

  limite: number;

  total: number;

  total_paginas: number;
}