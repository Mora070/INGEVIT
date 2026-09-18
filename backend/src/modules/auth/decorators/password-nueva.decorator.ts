import { applyDecorators } from '@nestjs/common';
import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const PASSWORD_MIN_CARACTERES = 8;
export const PASSWORD_MAX_CARACTERES = 128;

/**
 * Valida contraseñas que se establecerán por primera vez
 * o sustituirán una contraseña existente.
 *
 * No transforma el texto ni impone combinaciones de caracteres.
 * No debe utilizarse para validar la contraseña actual o el login:
 * esas entradas deben conservar compatibilidad con cuentas existentes.
 *
 * Esta validación de formato no comprueba contraseñas comprometidas.
 */
export function PasswordNueva(): PropertyDecorator {
  return applyDecorators(
    IsString({
      message: 'La contraseña debe ser un texto.',
    }),
    MinLength(PASSWORD_MIN_CARACTERES, {
      message:
        `La contraseña debe tener al menos ${PASSWORD_MIN_CARACTERES} caracteres.`,
    }),
    MaxLength(PASSWORD_MAX_CARACTERES, {
      message:
        `La contraseña no puede superar ${PASSWORD_MAX_CARACTERES} caracteres.`,
    }),
  );
}