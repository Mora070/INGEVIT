import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Matches,
} from 'class-validator';

/**
 * Campos de texto que acompañan al GeoTIFF en multipart/form-data.
 *
 * El archivo se recibe y valida por separado.
 * El proyecto procede de la ruta y el autor de la sesión.
 *
 * No acepta metadatos geográficos ni identificadores de Mapbox:
 * el backend debe obtenerlos mediante el procesamiento del archivo.
 */
export class SubirCapaDto {
  /** Nombre visible para los integrantes del proyecto. */
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({
    message: 'El nombre de la capa debe ser un texto.',
  })
  @IsNotEmpty({
    message: 'El nombre de la capa es obligatorio.',
  })
  @Matches(/^[^\u0000]*$/, {
    message: 'El nombre de la capa contiene un carácter no permitido.',
  })
  nombre!: string;

  /**
   * Si se omite, se guarda como texto vacío.
   * Conserva espacios y saltos de línea escritos por el usuario.
   * null no equivale a una descripción omitida.
   */
  @IsString({
    message: 'La descripción debe ser un texto.',
  })
  @Matches(/^[^\u0000]*$/, {
    message: 'La descripción contiene un carácter no permitido.',
  })
  descripcion: string = '';
}