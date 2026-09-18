import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * Datos de entrada para iniciar sesión con correo y contraseña.
 *
 * Responsabilidades:
 * - Comprobar el formato de los datos recibidos.
 * - Eliminar espacios exteriores del correo.
 * - Conservar exactamente la contraseña recibida.
 *
 * Esta clase no consulta usuarios, no compara hashes y no crea sesiones.
 * Esas responsabilidades pertenecerán al servicio de autenticación.
 */
export class LoginDto {
  /**
   * Correo de la cuenta.
   *
   * Solo normalizamos valores que ya sean texto. Otros tipos deben
   * fallar la validación, sin convertirse automáticamente en cadenas.
   */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'El correo debe ser un texto.' })
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  @IsEmail({}, { message: 'El correo debe tener un formato válido.' })
  correo!: string;

  /**
   * Contraseña presentada para verificar las credenciales.
   *
   * No aplicar trim(), minúsculas ni otras transformaciones:
   * cualquier carácter puede formar parte de la contraseña.
   *
   * No debe registrarse en logs ni almacenarse en PostgreSQL.
   * El servicio la comparará con el hash almacenado.
   */
  @IsString({ message: 'La contraseña debe ser un texto.' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  password!: string;
}