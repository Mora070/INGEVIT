import type { ActividadRow } from './actividad.types';

/**
 * Resultado interno para un proyecto disponible.
 *
 * El repositorio convierte el conteo de PostgreSQL a un número,
 * comprobando que pueda representarse como un entero seguro.
 */
export interface ActividadesPaginadasRow {
  actividades: ActividadRow[];
  total: number;
}

/**
 * null indica que el proyecto no está disponible para el solicitante.
 *
 * Un proyecto disponible sin actividades devuelve:
 * { actividades: [], total: 0 }
 */
export type ResultadoConsultaActividades =
  | ActividadesPaginadasRow
  | null;

/**
 * Fila auxiliar producida por el LEFT JOIN cuando la página no contiene
 * actividades, incluso si existen registros en otras páginas.
 *
 * Estos null corresponden al resultado del JOIN; no modifican
 * las restricciones NOT NULL de la tabla actividades.
 */
interface ActividadPaginaVaciaRow {
  id_actividad: null;
  id_proyecto: null;
  id_actor: null;
  tipo_accion: null;
  mensaje: null;
  fecha_creacion: null;
}

/**
 * Forma del resultado SQL antes de transformarlo.
 *
 * La consulta devolverá el conteo como texto para evitar una conversión
 * numérica que pueda perder precisión.
 */
export type ActividadPaginaConsultaRow = (
  | ActividadRow
  | ActividadPaginaVaciaRow
) & {
  total: string;
};