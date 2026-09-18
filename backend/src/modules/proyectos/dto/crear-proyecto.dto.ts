import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';

import type { EstadoProyecto } from '../types/proyecto.types';

/**
 * Estados de trabajo admitidos al crear un proyecto.
 * No se establece uno predeterminado porque la tabla no lo define.
 */
const ESTADOS_PROYECTO: EstadoProyecto[] = [
  'ACTIVA',
  'PAUSA',
  'FINALIZADA',
];

/**
 * Entrada para crear un proyecto.
 *
 * El backend asignará:
 * - id_propietario desde la sesión.
 * - id_proyecto mediante PostgreSQL.
 * - activo mediante el valor predeterminado de la tabla.
 *
 * No incluye esos campos para impedir que el cliente los controle.
 */
export class CrearProyectoDto {
  @IsString({ message: 'El nombre debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  nombre!: string;

  @IsString({ message: 'La descripción debe ser un texto.' })
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  descripcion!: string;

  @IsString({ message: 'La dirección debe ser un texto.' })
  @IsNotEmpty({ message: 'La dirección es obligatoria.' })
  direccion!: string;

  @IsString({ message: 'El contratante debe ser un texto.' })
  @IsNotEmpty({ message: 'El contratante es obligatorio.' })
  contratante!: string;

  /**
   * Se recibe una fecha de calendario, sin hora ni zona horaria.
   * La expresión regular restringe el formato y strict valida la fecha.
   */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de inicio debe tener formato YYYY-MM-DD.',
  })
  @IsDateString(
    { strict: true },
    { message: 'La fecha de inicio debe ser una fecha válida.' },
  )
  fecha_inicio!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de finalización debe tener formato YYYY-MM-DD.',
  })
  @IsDateString(
    { strict: true },
    { message: 'La fecha de finalización debe ser una fecha válida.' },
  )
  fecha_finalizacion?: string | null;

  @IsIn(ESTADOS_PROYECTO, {
    message: 'El estado del proyecto debe ser ACTIVA, PAUSA o FINALIZADA.',
  })
  estado_proyecto!: EstadoProyecto;

  /**
   * Si cualquiera de las coordenadas está presente, ambas se validan.
   * Así no se acepta una ubicación incompleta.
   *
   * Las coordenadas deben llegar como números JSON.
   */
  @ValidateIf(
    (datos: CrearProyectoDto) =>
      datos.latitud != null || datos.longitud != null,
  )
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'La latitud debe ser un número finito.' },
  )
  @IsLatitude({ message: 'La latitud debe estar entre -90 y 90.' })
  latitud?: number | null;

  @ValidateIf(
    (datos: CrearProyectoDto) =>
      datos.latitud != null || datos.longitud != null,
  )
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'La longitud debe ser un número finito.' },
  )
  @IsLongitude({ message: 'La longitud debe estar entre -180 y 180.' })
  longitud?: number | null;
}