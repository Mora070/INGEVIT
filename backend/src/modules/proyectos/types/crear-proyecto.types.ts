import type { EstadoProyecto } from './proyecto.types';

/**
 * Datos internos para insertar un proyecto.
 *
 * No es un DTO HTTP:
 * el servicio construye este objeto después de validar la solicitud.
 *
 * idPropietario debe proceder de la identidad autenticada.
 * Los campos opcionales ausentes deben convertirse a null.
 */
export interface CrearProyectoInput {
  idPropietario: string;

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