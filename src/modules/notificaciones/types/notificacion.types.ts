/** Valores existentes en obra.estado_envio. */
export type EstadoEnvioCorreo =
  | 'PENDIENTE'
  | 'ENVIADA'
  | 'FALLIDA';

/**
 * Registro interno de PostgreSQL.
 *
 * id_incidencia puede ser null porque la notificación se conserva
 * cuando se elimina la incidencia relacionada.
 */
export interface NotificacionRow {
  id_notificacion: string;
  id_receptor: string;
  id_actor: string;
  id_proyecto: string;
  id_incidencia: string | null;
  tipo: string;
  titulo: string;
  mensaje: string;
  estado_envio_correo: EstadoEnvioCorreo;
  fecha_creacion: Date;
}

/**
 * Datos públicos de una notificación del usuario autenticado.
 *
 * La consulta deberá filtrar por receptor antes de aplicar este mapeador.
 * El mapeador no comprueba permisos.
 */
export interface NotificacionResponse {
  id_notificacion: string;
  id_actor: string;
  id_proyecto: string;
  id_incidencia: string | null;
  tipo: string;
  titulo: string;
  mensaje: string;
  fecha_creacion: string;
}