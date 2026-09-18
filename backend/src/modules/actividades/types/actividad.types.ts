/**
 * Registro de actividad recuperado desde PostgreSQL.
 *
 * Con la configuración actual de pg, una columna timestamptz
 * se representa como Date en JavaScript.
 *
 * id_actor conserva la referencia al usuario que realizó la acción,
 * aunque posteriormente deje de colaborar en el proyecto.
 */
export interface ActividadRow {
  id_actividad: string;
  id_proyecto: string;
  id_actor: string;
  tipo_accion: string;
  mensaje: string;
  fecha_creacion: Date;
}

/**
 * Representación pública de una actividad.
 *
 * La fecha se entregará como texto ISO 8601 para que el frontend
 * pueda mostrarla en la zona horaria correspondiente.
 */
export interface ActividadResponse {
  id_actividad: string;
  id_proyecto: string;
  id_actor: string;
  tipo_accion: string;
  mensaje: string;
  fecha_creacion: string;
}