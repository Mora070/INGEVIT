import {
  IsNotEmpty,
  IsString,
} from 'class-validator';

/**
 * Datos admitidos para modificar el título de una fotografía.
 *
 * Esta operación modifica únicamente el título.
 * No reemplaza archivos ni cambia el proyecto, el autor,
 * las claves de almacenamiento o la fecha de subida.
 *
 * La identidad del solicitante procede de la sesión.
 * Los identificadores se recibirán mediante la ruta.
 *
 * El ValidationPipe global rechaza propiedades adicionales.
 */
export class ActualizarTituloFotografiaDto {
  @IsString({
    message: 'El título debe ser un texto.',
  })
  @IsNotEmpty({
    message: 'El título es obligatorio.',
  })
  titulo!: string;
}