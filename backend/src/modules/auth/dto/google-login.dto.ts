import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Recibe exclusivamente la credencial emitida por Google.
 *
 * Correo, nombre e identificador no se aceptan como campos separados:
 * se obtendrán del token después de verificarlo.
 */
export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(16384)
  credential!: string;
}