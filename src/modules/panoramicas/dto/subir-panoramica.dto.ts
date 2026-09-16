import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Metadatos enviados junto al archivo.
 *
 * El backend establece autor, proyecto, URL, clave, MIME y fecha.
 * El formato real de la imagen se comprobará a partir de sus bytes.
 */
export class SubirPanoramicaDto {
  @IsString({ message: 'El título debe ser un texto.' })
  @IsNotEmpty({ message: 'El título es obligatorio.' })
  titulo!: string;
}