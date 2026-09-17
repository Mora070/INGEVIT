import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength } from 'class-validator';

/**
 * Valida el correo solicitado sin comprobar si la cuenta existe.
 * Solo elimina espacios exteriores; no transforma otros tipos.
 */
export class SolicitarRecuperacionDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'El correo debe ser un texto.' })
  @IsEmail({}, { message: 'El correo debe tener un formato válido.' })
  @MaxLength(254, {
    message: 'El correo no puede superar 254 caracteres.',
  })
  correo!: string;
}