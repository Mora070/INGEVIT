/**
 * Describe cómo participa un usuario en un proyecto concreto.
 *
 * No representa un rol global ni concede permisos por sí mismo.
 * La propiedad se determina mediante proyectos.id_propietario.
 */
export type TipoParticipacionProyecto =
  | 'PROPIETARIO'
  | 'COLABORADOR';

/**
 * Datos seleccionados por la consulta de participantes.
 *
 * Los campos personales admiten null porque una cuenta puede tener
 * su perfil incompleto, incluyendo cuentas creadas mediante Google.
 */
export interface ParticipanteProyectoRow {
  id_usuario: string;
  nombre: string | null;
  apellidos: string | null;
  foto_perfil_url: string | null;
  participacion: TipoParticipacionProyecto;
}

/**
 * Contrato público de un participante.
 *
 * Se declara explícitamente para mantener la respuesta independiente
 * de futuros cambios en las columnas consultadas por el repositorio.
 * No incluye credenciales ni identificadores de autenticación.
 */
export interface ParticipanteProyectoResponse {
  id_usuario: string;
  nombre: string | null;
  apellidos: string | null;
  foto_perfil_url: string | null;
  participacion: TipoParticipacionProyecto;
}