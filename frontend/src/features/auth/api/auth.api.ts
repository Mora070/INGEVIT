import { ApiError, cuerpoJson, http } from '../../../shared/api/http';
import type { Usuario } from '../types/usuario';

export interface CredencialesLogin {
  correo: string;
  password: string;
}


export interface DatosRegistro {
  correo: string;
  password: string;
  nombre?: string | null;
  apellidos?: string | null;
  telefono?: string | null;
  ubicacion?: string | null;
}


/**
 * Consulta la sesión al abrir o recargar la aplicación.
 *
 * Solo HTTP 401 significa que no hay una sesión válida.
 * Los fallos de red o del servidor se propagan para permitir
 * mostrar un error y ofrecer un reintento.
 */
export async function consultarSesion(
  signal?: AbortSignal,
): Promise<Usuario | null> {
  try {
    return await http<Usuario>('/api/auth/me', { signal });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

/**
 * El navegador recibe la cookie mediante Set-Cookie.
 * El cuerpo de la respuesta contiene únicamente el perfil.
 */
export function iniciarSesion(
  credenciales: CredencialesLogin,
): Promise<Usuario> {
  return http<Usuario>('/api/auth/login', {
    method: 'POST',
    ...cuerpoJson(credenciales),
  });
}


/**
 * Crea una cuenta local.
 *
 * El backend devuelve únicamente el perfil creado.
 * Registrar una cuenta no inicia sesión automáticamente.
 */
export function registrarUsuario(
  datos: DatosRegistro,
): Promise<Usuario> {
  return http<Usuario>('/api/auth/register', {
    method: 'POST',
    ...cuerpoJson(datos),
  });
}



/**
 * Solicita al backend que retire la cookie.
 * El estado visual de la sesión se actualizará tras confirmar el éxito.
 */
export function cerrarSesion(): Promise<void> {
  return http<void>('/api/auth/logout', {
    method: 'POST',
  });
}