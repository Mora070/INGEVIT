import {
  IsEnum,
  IsNotEmpty,
  IsString,
} from 'class-validator';

import {
  PrioridadIncidencia,
} from './crear-incidencia.dto';

/**
 * Valores existentes en obra.estado_incidencia.
 */
export enum EstadoIncidencia {
  PENDIENTE = 'PENDIENTE',
  EN_PROCESO = 'EN_PROCESO',
  SOLUCIONADA = 'SOLUCIONADA',
}

/**
 * Datos descriptivos editables de una incidencia.
 *
 * Se utiliza para incidencias de plano.
 *
 * No modifica:
 * - autoría;
 * - ubicación;
 * - recurso relacionado;
 * - fecha.
 */
export class ActualizarIncidenciaDto {
  @IsString({
    message:
      'El título debe ser un texto.',
  })
  @IsNotEmpty({
    message:
      'El título es obligatorio.',
  })
  titulo!: string;

  @IsString({
    message:
      'La descripción debe ser un texto.',
  })
  @IsNotEmpty({
    message:
      'La descripción es obligatoria.',
  })
  descripcion!: string;

  @IsEnum(
    PrioridadIncidencia,
    {
      message:
        'La prioridad debe ser BAJA, MEDIA o ALTA.',
    },
  )
  prioridad!: PrioridadIncidencia;

  @IsEnum(
    EstadoIncidencia,
    {
      message:
        'El estado debe ser PENDIENTE, EN_PROCESO o SOLUCIONADA.',
    },
  )
  estado!: EstadoIncidencia;
}