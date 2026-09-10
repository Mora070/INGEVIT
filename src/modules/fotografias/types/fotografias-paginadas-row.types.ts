import type { FotografiaRow } from './fotografia.types';

/**
 * Resultado interno de la consulta para un proyecto disponible.
 *
 * El repositorio convierte el conteo de PostgreSQL a un número,
 * comprobando que pueda representarse como un entero seguro.
 */
export interface FotografiasPaginadasRow {
  fotografias: FotografiaRow[];
  total: number;
}

/**
 * null indica que el proyecto no está disponible para el solicitante.
 *
 * Un proyecto disponible sin fotografías devuelve:
 * { fotografias: [], total: 0 }
 */
export type ResultadoConsultaFotografias =
  | FotografiasPaginadasRow
  | null;

/**
 * Fila auxiliar producida por el LEFT JOIN cuando la página está vacía.
 *
 * Estos valores null pertenecen al resultado de la consulta.
 * No modifican las restricciones NOT NULL de la tabla fotografias.
 */
interface FotografiaPaginaVaciaRow {
  id_fotografia: null;
  id_proyecto: null;
  id_usuario_subida: null;
  titulo: null;
  url: null;
  s3_key: null;
  fecha_subida: null;
}

/**
 * Resultado SQL antes de transformarlo al contrato interno.
 *
 * El conteo llegará como texto para comprobar su precisión antes
 * de convertirlo a number.
 */
export type FotografiaPaginaConsultaRow = (
  | FotografiaRow
  | FotografiaPaginaVaciaRow
) & {
  total: string;
};