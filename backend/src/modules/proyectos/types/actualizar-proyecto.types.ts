import type { EstadoProyecto } from './proyecto.types';

/**
 * Datos internos que pueden reemplazarse al editar un proyecto.
 *
 * El servicio construirá este objeto explícitamente desde el DTO.
 * Los identificadores del proyecto y del solicitante se pasarán
 * por separado a la operación del repositorio.
 */
export interface ActualizarProyectoInput {
  nombre: string;
  descripcion: string;
  direccion: string;
  contratante: string;

  fechaInicio: string;
  fechaFinalizacion: string | null;

  estadoProyecto: EstadoProyecto;

  latitud: number | null;
  longitud: number | null;
}