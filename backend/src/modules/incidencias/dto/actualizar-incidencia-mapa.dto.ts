import {
  IsNumber,
  Max,
  Min,
} from 'class-validator';

import {
  ActualizarIncidenciaDto,
} from './actualizar-incidencia.dto';

/**
 * Datos editables de una incidencia ubicada
 * directamente sobre el mapa.
 *
 * Además de los datos descriptivos,
 * permite modificar su ubicación.
 *
 * No permite cambiar:
 * - creador;
 * - fotografía asociada;
 * - panorámica asociada;
 * - fecha de creación.
 */
export class ActualizarIncidenciaMapaDto
  extends ActualizarIncidenciaDto {
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message:
        'La latitud debe ser un número finito.',
    },
  )
  @Min(
    -90,
    {
      message:
        'La latitud debe ser mayor o igual a -90.',
    },
  )
  @Max(
    90,
    {
      message:
        'La latitud debe ser menor o igual a 90.',
    },
  )
  latitud!: number;

  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message:
        'La longitud debe ser un número finito.',
    },
  )
  @Min(
    -180,
    {
      message:
        'La longitud debe ser mayor o igual a -180.',
    },
  )
  @Max(
    180,
    {
      message:
        'La longitud debe ser menor o igual a 180.',
    },
  )
  longitud!: number;
}