/**
 * Valores permitidos por los ENUM del esquema obra.
 *
 * Deben mantenerse alineados con las migraciones SQL.
 * Estas definiciones comprueban tipos durante la compilación;
 * no sustituyen la validación de datos recibidos por HTTP.
 */
export type RolUsuario = 'ADMINISTRADOR' | 'USUARIO';

export type EstadoUsuario = 'ACTIVO' | 'INACTIVO';

/**
 * Representación interna de una fila completa de obra.usuarios.
 *
 * Uso exclusivo dentro del backend.
 * No devolver directamente desde un controlador, porque contiene
 * información de autenticación.
 *
 * Se conservan los nombres de columnas para facilitar la lectura
 * de las consultas y su correspondencia con PostgreSQL.
 */
export interface UsuarioRow {
  id_usuario: string;
  nombre: string | null;
  apellidos: string | null;
  foto_perfil_url: string | null;
  correo: string;
  telefono: string | null;
  password_hash: string | null;
  fecha_creacion: Date;
  ubicacion: string | null;
  rol: RolUsuario;
  estado: EstadoUsuario;
  google_sub: string | null;
}

/**
 * Campos permitidos en una respuesta del perfil de usuario.
 *
 * No contiene password_hash ni google_sub.
 * La fecha se representa como texto ISO 8601 para su transporte
 * mediante JSON.
 *
 * Este tipo no concede autorización para consultar un perfil.
 * Los permisos se comprobarán antes de construir la respuesta.
 */
export interface UsuarioResponse {
  id_usuario: string;
  nombre: string | null;
  apellidos: string | null;
  foto_perfil_url: string | null;
  correo: string;
  telefono: string | null;
  fecha_creacion: string;
  ubicacion: string | null;
  rol: RolUsuario;
  estado: EstadoUsuario;
}