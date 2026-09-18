import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  NotContains,
} from 'class-validator';

/**
 * Normaliza los campos opcionales del perfil.
 *
 * - Conserva los tipos incorrectos para que la validación los rechace.
 * - Elimina únicamente espacios exteriores.
 * - Convierte un texto vacío en null para borrar el dato.
 */
function normalizarTexto(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim() || null;
}

/**
 * Actualización parcial de los datos personales.
 *
 * Campo omitido: conserva el valor existente.
 * null o texto vacío: elimina el dato.
 * Texto válido: sustituye el valor existente.
 *
 * El servicio rechazará una solicitud sin campos modificables.
 * Los límites son reglas de la API; las columnas actuales son text.
 */
export class ActualizarMiPerfilDto {
  @Transform(({ value }) => normalizarTexto(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @NotContains('\u0000')
  nombre?: string | null;

  @Transform(({ value }) => normalizarTexto(value))
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @NotContains('\u0000')
  apellidos?: string | null;

  /**
   * Texto para conservar prefijos internacionales y separadores.
   * No acredita que el número exista o pertenezca al usuario.
   */
  @Transform(({ value }) => normalizarTexto(value))
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @NotContains('\u0000')
  telefono?: string | null;

  @Transform(({ value }) => normalizarTexto(value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @NotContains('\u0000')
  ubicacion?: string | null;
}