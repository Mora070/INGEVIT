import {
  IsNotEmpty,
  IsString,
} from 'class-validator';

import { PasswordNueva } from '../decorators/password-nueva.decorator';

/**
 * Solicitud de cambio de contraseña.
 *
 * No transforma, recorta ni normaliza las contraseñas.
 * La identidad procede de la sesión autenticada.
 *
 * La contraseña actual conserva compatibilidad con cuentas existentes.
 * La nueva contraseña debe cumplir la política de longitud.
 *
 * El servicio comprobará la contraseña actual y rechazará reutilizarla.
 */
export class CambiarPasswordDto {
  @IsString({
    message: 'La contraseña actual debe ser un texto.',
  })
  @IsNotEmpty({
    message: 'La contraseña actual es obligatoria.',
  })
  password_actual!: string;

  @PasswordNueva()
  password_nueva!: string;
}