import {
  IsEnum,
  IsNotEmpty,
  IsString,
} from 'class-validator';

import { PrioridadIncidencia } from './crear-incidencia.dto';

/** Valores existentes en obra.estado_incidencia. */
export enum EstadoIncidencia {
  PENDIENTE = 'PENDIENTE',
  EN_PROCESO = 'EN_PROCESO',
  SOLUCIONADA = 'SOLUCIONADA',
}

/**
 * Datos editables de una incidencia.
 *
 * Los cuatro campos deben enviarse en cada guardado.
 * No permite cambiar la autoría ni mover el marcador.
 *
 * La validación del DTO no concede permisos de edición.
 */
export class ActualizarIncidenciaDto {
  @IsString({ message: 'El título debe ser un texto.' })
  @IsNotEmpty({ message: 'El título es obligatorio.' })
  titulo!: string;

  @IsString({ message: 'La descripción debe ser un texto.' })
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  descripcion!: string;

  @IsEnum(PrioridadIncidencia, {
    message: 'La prioridad debe ser BAJA, MEDIA o ALTA.',
  })
  prioridad!: PrioridadIncidencia;

  @IsEnum(EstadoIncidencia, {
    message: 'El estado debe ser PENDIENTE, EN_PROCESO o SOLUCIONADA.',
  })
  estado!: EstadoIncidencia;
}