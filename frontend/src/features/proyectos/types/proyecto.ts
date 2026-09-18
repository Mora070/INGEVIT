export type EstadoProyecto =
  | 'ACTIVA'
  | 'PAUSA'
  | 'FINALIZADA';

export interface Proyecto {
  id_proyecto: string;
  id_propietario: string;

  nombre: string;
  descripcion: string;
  direccion: string;
  contratante: string;

  fecha_inicio: string;
  fecha_finalizacion: string | null;

  estado_proyecto: EstadoProyecto;
  activo: boolean;

  latitud: number | null;
  longitud: number | null;
}

export interface ProyectosPaginados {
  proyectos: Proyecto[];

  pagina: number;
  limite: number;

  total: number;
  total_paginas: number;
}