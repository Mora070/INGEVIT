import type {
  UsuarioResponse,
  UsuarioRow,
} from '../types/usuario.types';

/**
 * Convierte un usuario interno en una respuesta de perfil.
 *
 * Selecciona explícitamente los campos permitidos para evitar
 * exponer password_hash, google_sub o futuras columnas internas.
 *
 * No modifica el objeto recibido.
 * No verifica permisos: el servicio debe autorizar la operación
 * antes de utilizar esta función.
 */
export function toUsuarioResponse(
  usuario: UsuarioRow,
): UsuarioResponse {
  return {
    id_usuario: usuario.id_usuario,
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    foto_perfil_url: usuario.foto_perfil_url,
    correo: usuario.correo,
    telefono: usuario.telefono,
    fecha_creacion: usuario.fecha_creacion.toISOString(),
    ubicacion: usuario.ubicacion,
    rol: usuario.rol,
    estado: usuario.estado,
  };
}