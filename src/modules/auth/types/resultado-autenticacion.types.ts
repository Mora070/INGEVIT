import type { UsuarioResponse } from '../../usuarios/types/usuario.types';

/**
 * Resultado interno de un inicio de sesión correcto.
 *
 * El controlador utilizará:
 * - tokenAcceso para establecer la cookie HttpOnly.
 * - usuario para construir el cuerpo de la respuesta.
 *
 * No devolver este objeto completo como JSON ni registrarlo en logs:
 * tokenAcceso es una credencial.
 */
export interface ResultadoAutenticacion {
  tokenAcceso: string;
  usuario: UsuarioResponse;
}