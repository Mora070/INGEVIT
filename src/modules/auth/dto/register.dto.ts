import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Datos admitidos para crear una cuenta mediante correo y contraseña.
 *
 * No admite campos administrados por el backend:
 * id_usuario, rol, estado, password_hash, google_sub o fecha_creacion.
 *
 * El ValidationPipe rechazará esos campos si el cliente los envía.
 */
export class RegisterDto {
  /**
   * Correo de la nueva cuenta.
   *
   * Eliminamos espacios exteriores sin convertir otros tipos a texto.
   * PostgreSQL garantizará la unicidad mediante lower(correo).
   */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'El correo debe ser un texto.' })
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  @IsEmail({}, { message: 'El correo debe tener un formato válido.' })
  correo!: string;

  /**
   * Contraseña que el backend transformará en un hash.
   *
   * No se normaliza, no se devuelve en respuestas
   * y no se almacena directamente en PostgreSQL.
   */
  @IsString({ message: 'La contraseña debe ser un texto.' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  password!: string;

  /**
   * Información de perfil opcional en esta entrada.
   * La tabla existente permite almacenar estos campos como NULL.
   *
   * IsOptional omite la validación cuando el valor es undefined o null.
   * Si se proporciona otro valor, debe ser texto.
   */
  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto.' })
  nombre?: string | null;

  @IsOptional()
  @IsString({ message: 'Los apellidos deben ser un texto.' })
  apellidos?: string | null;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser un texto.' })
  telefono?: string | null;

  @IsOptional()
  @IsString({ message: 'La ubicación debe ser un texto.' })
  ubicacion?: string | null;
}