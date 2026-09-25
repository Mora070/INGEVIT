import type {
  ProyectoResponse,
  ProyectoRow,
} from './proyecto.types';

import type {
  ParticipanteProyectoResponse,
  ParticipanteProyectoRow,
} from './participante-proyecto.types';

/**
 * Representación interna de un proyecto dentro del listado paginado.
 *
 * Extiende la fila normal del proyecto con la información adicional
 * necesaria para mostrar el resumen en Inicio.
 */
export interface ProyectoListadoRow extends ProyectoRow {
  /**
   * Propietario y colaboradores del proyecto.
   */
  equipo: ParticipanteProyectoRow[];

  /**
   * Fecha de la actividad más reciente registrada para el proyecto.
   *
   * Puede ser null si el proyecto no tiene actividades registradas.
   */
  ultima_actualizacion: Date | null;
}

/**
 * Representación pública de un proyecto dentro del listado paginado.
 *
 * No reemplaza ProyectoResponse.
 * Se utiliza únicamente para el listado general de proyectos.
 */
export interface ProyectoListadoResponse
  extends ProyectoResponse {
  /**
   * Propietario y colaboradores disponibles para mostrar en la tabla.
   */
  equipo: ParticipanteProyectoResponse[];

  /**
   * Fecha y hora ISO 8601 de la última actividad registrada.
   */
  ultima_actualizacion: string | null;
}