/**
 * Identidad obtenida después de verificar un token.
 *
 * La versión todavía debe compararse con PostgreSQL antes
 * de autorizar la solicitud.
 */
export interface IdentidadSesion {
  id_usuario: string;
  version_sesion: number;
}