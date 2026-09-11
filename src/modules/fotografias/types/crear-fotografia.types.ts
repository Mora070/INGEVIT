/**
 * Datos internos para insertar los metadatos de una fotografía.
 *
 * Este contrato no es un DTO público.
 * El servicio construye sus valores después de comprobar el acceso,
 * procesar la imagen y guardar ambas versiones.
 */
export interface CrearFotografiaInput {
  /** Proyecto autorizado al que pertenece la fotografía. */
  idProyecto: string;

  /** Identidad obtenida de la sesión, nunca del cuerpo de la petición. */
  idUsuarioSubida: string;

  /** Título validado mediante SubirFotografiaDto. */
  titulo: string;

  /** Referencia de acceso a la versión optimizada. */
  url: string;

  /** Clave de la versión optimizada guardada. */
  s3Key: string;

  /** Clave del original guardado sin modificar sus bytes. */
  originalS3Key: string;
}