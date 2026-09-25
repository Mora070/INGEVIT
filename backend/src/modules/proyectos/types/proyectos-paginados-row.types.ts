import type {
  ProyectoListadoRow,
} from './proyecto-listado.types';

/**
 * Resultado interno del repositorio para el listado paginado.
 *
 * Cada proyecto incluye la información adicional necesaria
 * para el resumen de Inicio:
 * - equipo
 * - última actualización
 */
export interface ProyectosPaginadosRow {
  proyectos: ProyectoListadoRow[];
  total: number;
}

/**
 * Cuando la página está vacía, el LEFT JOIN devuelve los campos
 * del proyecto como null, pero conserva el total.
 */
type ProyectoListadoVacioRow = {
  [Campo in keyof ProyectoListadoRow]: null;
};

/**
 * COUNT devuelve BIGINT, que recibiremos explícitamente como texto.
 *
 * La consulta paginada puede devolver:
 * - un proyecto enriquecido;
 * - o una fila vacía cuando no existen proyectos en esa página.
 */
export type ProyectoPaginaConsultaRow = (
  | ProyectoListadoRow
  | ProyectoListadoVacioRow
) & {
  total: string;
};