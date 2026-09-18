
import type {
  ParticipanteProyectoResponse,
  ParticipanteProyectoRow,
} from '../types/participante-proyecto.types';

/**
 * Construye la respuesta pública de un participante del proyecto.
 *
 * Selecciona explícitamente los campos autorizados y crea un objeto nuevo
 * para evitar modificar el registro recibido desde el repositorio.
 *
 * Conserva los valores null de los perfiles incompletos.
 */
export function mapearParticipanteProyecto(
  participante: ParticipanteProyectoRow,
): ParticipanteProyectoResponse {
  return {
    id_usuario: participante.id_usuario,
    nombre: participante.nombre,
    apellidos: participante.apellidos,
    foto_perfil_url: participante.foto_perfil_url,
    participacion: participante.participacion,
  };
}