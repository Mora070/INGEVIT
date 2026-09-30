import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import {
  PrioridadIncidencia,
} from './crear-incidencia.dto';

/**
 * Datos públicos para crear una incidencia directamente en el mapa.
 *
 * Todas las incidencias de mapa requieren:
 * - latitud;
 * - longitud.
 *
 * Existen tres posibilidades:
 *
 * 1. Incidencia de texto:
 *    - Sin id_fotografia.
 *    - Sin id_panoramica.
 *    - El usuario selecciona la ubicación en el mapa.
 *
 * 2. Incidencia vinculada a una fotografía:
 *    - Proporciona id_fotografia.
 *    - No proporciona id_panoramica.
 *    - El usuario selecciona la ubicación en el mapa.
 *
 * 3. Incidencia vinculada a una panorámica:
 *    - Proporciona id_panoramica.
 *    - No proporciona id_fotografia.
 *    - El usuario selecciona la ubicación en el mapa.
 *
 * El proyecto procede de la ruta.
 * El creador procede exclusivamente de la sesión autenticada.
 *
 * El estado inicial lo establece el backend como PENDIENTE.
 *
 * La exclusividad entre fotografía y panorámica
 * se comprueba en el servicio.
 */
export class CrearIncidenciaMapaDto {
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

  /**
   * Ubicación seleccionada por el usuario
   * directamente sobre el mapa.
   *
   * Es obligatoria para cualquier tipo
   * de incidencia de mapa.
   */
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

  /**
   * Fotografía existente del mismo proyecto.
   *
   * El servicio comprobará:
   * - que exista;
   * - que pertenezca al proyecto;
   * - que no venga simultáneamente
   *   con id_panoramica.
   *
   * La fotografía no determina
   * la ubicación de la incidencia.
   */
  @IsOptional()
  @IsUUID(
    '4',
    {
      message:
        'El identificador de la fotografía debe ser un UUID válido.',
    },
  )
  id_fotografia?: string;

  /**
   * Panorámica existente del mismo proyecto.
   *
   * El servicio comprobará:
   * - que exista;
   * - que pertenezca al proyecto;
   * - que no venga simultáneamente
   *   con id_fotografia.
   *
   * La panorámica no determina
   * la ubicación de la incidencia.
   */
  @IsOptional()
  @IsUUID(
    '4',
    {
      message:
        'El identificador de la panorámica debe ser un UUID válido.',
    },
  )
  id_panoramica?: string;
}