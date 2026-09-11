import {
  IsNotEmpty,
  IsString,
} from 'class-validator';

/**
 * Metadatos recibidos al subir una fotografía.
 *
 * El archivo se recibirá por separado mediante multipart/form-data.
 *
 * No admite:
 * - Identidad del usuario que sube el archivo.
 * - URL o clave de almacenamiento.
 * - Identificador o fecha de creación de la fotografía.
 *
 * Esos valores los determina el backend.
 */
export class SubirFotografiaDto {
  @IsString({
    message: 'El título debe ser un texto.',
  })
  @IsNotEmpty({
    message: 'El título es obligatorio.',
  })
  titulo!: string;
}