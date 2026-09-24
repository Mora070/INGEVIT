import {
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { PrioridadIncidencia } from './crear-incidencia.dto';

/**
 * Datos públicos para crear una incidencia directamente en el mapa.
 *
 * El proyecto procede de la ruta y el creador de la sesión.
 * El backend establece el estado inicial PENDIENTE.
 *
 * Esta operación no admite plano, página ni coordenadas X/Y.
 * El servicio guardará esos campos como NULL.
 *
 * Recibe JSON: las coordenadas deben ser números, no cadenas.
 * No utiliza la conversión de texto necesaria para archivos multipart.
 */
export class CrearIncidenciaMapaDto {
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

  /** Latitud WGS84 del punto seleccionado manualmente en el mapa. */
  @IsDefined({ message: 'La latitud es obligatoria.' })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'La latitud debe ser un número finito.' },
  )
  @Min(-90, { message: 'La latitud debe ser mayor o igual a -90.' })
  @Max(90, { message: 'La latitud debe ser menor o igual a 90.' })
  latitud!: number;

  /** Longitud WGS84 del punto seleccionado manualmente en el mapa. */
  @IsDefined({ message: 'La longitud es obligatoria.' })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'La longitud debe ser un número finito.' },
  )
  @Min(-180, { message: 'La longitud debe ser mayor o igual a -180.' })
  @Max(180, { message: 'La longitud debe ser menor o igual a 180.' })
  longitud!: number;
}