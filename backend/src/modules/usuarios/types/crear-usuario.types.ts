/**
 * Datos internos para crear una cuenta tradicional.
 *
 * No es un DTO HTTP: lo construye el backend después de validar
 * la solicitud y generar el hash de la contraseña.
 *
 * Los campos opcionales del perfil deben llegar normalizados a null
 * cuando no se hayan proporcionado.
 *
 * No incluye rol, estado, identificador ni identidad de Google:
 * el cliente no controla esos valores.
 */
export interface CrearUsuarioTradicionalInput {
  correo: string;
  passwordHash: string;
  nombre: string | null;
  apellidos: string | null;
  telefono: string | null;
  ubicacion: string | null;
}