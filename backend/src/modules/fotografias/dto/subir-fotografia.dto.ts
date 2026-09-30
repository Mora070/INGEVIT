import {
  IsNotEmpty,
  IsString,
} from 'class-validator';

/**
 * Metadatos recibidos al subir una fotografía.
 *
 * El archivo se recibe por separado mediante multipart/form-data.
 *
 * La ubicación ya no pertenece a la fotografía.
 * Se definirá posteriormente al crear una incidencia en el mapa.
 *
 * No admite:
 * - identidad del usuario;
 * - proyecto;
 * - URL;
 * - clave de almacenamiento;
 * - fecha;
 * - ubicación geográfica.
 *
 * Esos valores los determina o administra el backend.
 */
export class SubirFotografiaDto {
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