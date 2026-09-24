import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Permite modificar únicamente el título de una panorámica.
 *
 * Es independiente del DTO de subida: cambiar el título no requiere
 * reenviar el archivo ni la ubicación geográfica.
 *
 * El pipe global rechaza propiedades adicionales.
 */
export class ActualizarPanoramicaDto {
  @IsString({ message: 'El título debe ser un texto.' })
  @IsNotEmpty({ message: 'El título es obligatorio.' })
  titulo!: string;
}