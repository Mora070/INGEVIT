import {
  IsNotEmpty,
  IsString,
} from 'class-validator';

/**
 * Metadatos enviados junto al archivo.
 *
 * La ubicación ya no se solicita durante la subida.
 * Se definirá al crear una incidencia sobre el mapa.
 *
 * El backend establece:
 * - autor;
 * - proyecto;
 * - URL;
 * - clave de almacenamiento;
 * - MIME;
 * - fecha.
 *
 * El formato real de la imagen se comprueba
 * a partir de sus bytes.
 */
export class SubirPanoramicaDto {
  @IsString({
    message:
      'El título debe ser un texto.',
  })
  @IsNotEmpty({
    message:
      'El título es obligatorio.',
  })
  titulo!: string;
}