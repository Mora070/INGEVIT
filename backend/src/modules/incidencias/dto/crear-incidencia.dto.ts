import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Valores admitidos por obra.prioridad_incidencia. */
export enum PrioridadIncidencia {
  BAJA = 'BAJA',
  MEDIA = 'MEDIA',
  ALTA = 'ALTA',
}

/**
 * Datos que el cliente puede proporcionar al crear una incidencia.
 *
 * El proyecto y el plano se recibirán como parámetros de la ruta.
 * El creador procederá de la sesión autenticada.
 * El servicio establecerá el estado inicial PENDIENTE.
 *
 * No convierte cadenas en números: el JSON debe contener números.
 */
export class CrearIncidenciaDto {
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

  /**
   * Las páginas se numeran desde 1.
   *
   * El límite superior aquí corresponde al tipo integer de PostgreSQL.
   * El servicio comprobará además el número real de páginas del plano.
   */
  @IsInt({ message: 'La página debe ser un número entero.' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1.' })
  @Max(2147483647, { message: 'El número de página es demasiado grande.' })
  numero_pagina!: number;

  /**
   * Exige valores numéricos finitos.
   *
   * Esta validación no presupone coordenadas normalizadas entre 0 y 1.
   * La unidad y el origen deberán coincidir con el contrato del visor.
   */
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'La coordenada X debe ser un número finito.' },
  )
  coordenada_x!: number;

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'La coordenada Y debe ser un número finito.' },
  )
  coordenada_y!: number;
}