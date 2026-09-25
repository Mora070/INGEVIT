export type EstadoProyecto =
  | 'ACTIVA'
  | 'PAUSA'
  | 'FINALIZADA';

export type TipoParticipacionProyecto =
  | 'PROPIETARIO'
  | 'COLABORADOR';

/**
 * Datos básicos de un participante del proyecto.
 */
export interface ParticipanteProyecto {
  id_usuario: string;
  nombre: string | null;
  apellidos: string | null;
  foto_perfil_url: string | null;
  participacion: TipoParticipacionProyecto;
}

/**
 * Contrato base de un proyecto.
 *
 * Este tipo sigue representando los endpoints normales
 * de creación, detalle y actualización.
 */
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

/**
 * Proyecto recibido específicamente dentro del listado paginado.
 *
 * Incluye los datos adicionales necesarios para Inicio.
 */
export interface ProyectoListado
  extends Proyecto {
  equipo: ParticipanteProyecto[];

  /**
   * Fecha ISO de la actividad más reciente.
   *
   * Puede ser null si todavía no existe actividad registrada.
   */
  ultima_actualizacion: string | null;
}

/**
 * Respuesta del listado paginado.
 */
export interface ProyectosPaginados {
  proyectos: ProyectoListado[];
  pagina: number;
  limite: number;
  total: number;
  total_paginas: number;
}