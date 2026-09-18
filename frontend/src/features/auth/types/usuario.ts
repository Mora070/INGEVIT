/**
 * Perfil público devuelto por el backend.
 * No incluye hashes, credenciales de Google ni versión de sesión.
 */
export interface Usuario {
  id_usuario: string;
  nombre: string | null;
  apellidos: string | null;
  foto_perfil_url: string | null;
  correo: string;
  telefono: string | null;
  fecha_creacion: string;
  ubicacion: string | null;
  rol: 'USUARIO' | 'ADMINISTRADOR';
  estado: 'ACTIVO' | 'INACTIVO';
}