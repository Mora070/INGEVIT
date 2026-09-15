import {
  IsNotEmpty,
  IsString,
} from 'class-validator';

/**
 * Metadatos de subida del plano.
 *
 * El archivo PDF se recibirá por separado.
 * El backend determina autor, URL, clave, MIME y fecha.
 * ValidationPipe rechazará propiedades adicionales.
 */
export class SubirPlanoDto {
  @IsString({
    message: 'El título debe ser un texto.',
  })
  @IsNotEmpty({
    message: 'El título es obligatorio.',
  })
  titulo!: string;

  /*
   * La descripción debe estar presente y ser texto.
   * No imponemos una longitud mínima ni prohibimos el texto vacío.
   */
  @IsString({
    message: 'La descripción debe ser un texto.',
  })
  descripcion!: string;
}