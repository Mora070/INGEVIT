import { IsString, Length, Matches } from 'class-validator';
import { PasswordNueva } from '../decorators/password-nueva.decorator';
import { SolicitarRecuperacionDto } from './solicitar-recuperacion.dto';

export class RestablecerPasswordDto extends SolicitarRecuperacionDto {
  // Texto para conservar ceros iniciales. No se transforma.
  @IsString()
  @Length(8, 8)
  @Matches(/^[0-9]{8}$/, {
    message: 'El código debe contener exactamente ocho dígitos.',
  })
  codigo!: string;

  @PasswordNueva()
  password_nueva!: string;
}