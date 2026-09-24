import {
  IsBoolean,
  IsInt,
  IsNumber,
  Max,
  Min,
} from 'class-validator';

/**
 * Configuración compartida de una capa del proyecto.
 *
 * Cada guardado envía los tres campos.
 * Recibe JSON: no convierte textos en números ni booleanos.
 *
 * No permite modificar el archivo, los metadatos geográficos
 * ni el estado del procesamiento.
 *
 * El servicio debe comprobar que el solicitante sea el propietario.
 */
export class ActualizarConfiguracionCapaDto {
  /** Transparencia: 0 completamente transparente; 1 completamente opaca. */
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'La opacidad debe ser un número finito.' },
  )
  @Min(0, { message: 'La opacidad debe ser mayor o igual a 0.' })
  @Max(1, { message: 'La opacidad debe ser menor o igual a 1.' })
  opacidad!: number;

  /**
   * Preferencia compartida de visualización.
   * Una capa solo podrá dibujarse cuando además esté LISTA.
   */
  @IsBoolean({ message: 'La visibilidad debe ser true o false.' })
  visible!: boolean;

  /** Los valores mayores se dibujan encima de los menores. */
  @IsInt({ message: 'El orden debe ser un número entero.' })
  @Min(0, { message: 'El orden debe ser mayor o igual a 0.' })
  @Max(2147483647, { message: 'El orden es demasiado grande.' })
  orden!: number;
}