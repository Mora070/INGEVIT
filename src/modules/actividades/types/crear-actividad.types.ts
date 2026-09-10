/**
 * Datos internos para registrar una acción sobre un proyecto.
 *
 * No es un DTO HTTP.
 * El backend determina el actor, el tipo de acción y el mensaje.
 *
 * PostgreSQL genera el identificador y la fecha de creación.
 */
export interface CrearActividadInput {
  idProyecto: string;
  idActor: string;
  tipoAccion: string;
  mensaje: string;
}