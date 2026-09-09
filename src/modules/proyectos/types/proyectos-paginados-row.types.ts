import type { ProyectoRow } from './proyecto.types';

/**
 * Resultado interno del repositorio.
 * El servicio convertirá los proyectos mediante el mapper.
 */
export interface ProyectosPaginadosRow {
  proyectos: ProyectoRow[];
  total: number;
}

/**
 * Cuando la página está vacía, el LEFT JOIN devuelve los campos
 * del proyecto como null, pero conserva el total.
 */
type ProyectoVacioRow = {
  [Campo in keyof ProyectoRow]: null;
};

/**
 * COUNT devuelve BIGINT, que recibiremos explícitamente como texto.
 */
export type ProyectoPaginaConsultaRow = (
  | ProyectoRow
  | ProyectoVacioRow
) & {
  total: string;
};