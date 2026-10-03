import {
  IsNumber,
  IsOptional,
  IsUUID,
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
 * permite modificar:
 * - ubicación;
 * - fotografía asociada;
 * - panorámica asociada.
 *
 * La validación de que el recurso multimedia
 * pertenece realmente al proyecto se realiza
 * en el servicio de edición.
 *
 * No permite cambiar:
 * - creador;
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

  @IsOptional()
  @IsUUID(
    '4',
    {
      message:
        'La fotografía asociada no es válida.',
    },
  )
  id_fotografia?:
    string | null;

  @IsOptional()
  @IsUUID(
    '4',
    {
      message:
        'La panorámica asociada no es válida.',
    },
  )
  id_panoramica?:
    string | null;
}