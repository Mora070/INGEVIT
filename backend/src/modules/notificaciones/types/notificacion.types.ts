export type EstadoEnvioCorreo =
  | 'PENDIENTE'
  | 'ENVIADA'
  | 'FALLIDA';

export type DestinoNotificacion =
  | 'RESUMEN'
  | 'FOTOGRAFIAS'
  | 'PLANOS'
  | 'PANORAMICAS'
  | 'MAPA'
  | 'CAPAS'
  | 'COLABORADORES';

export interface NotificacionRow {
  id_notificacion: string;
  id_receptor: string;
  id_actor: string;
  id_proyecto: string;
  id_incidencia: string | null;

  tipo: string;
  titulo: string;
  mensaje: string;

  destino:
    DestinoNotificacion | null;

  id_recurso:
    string | null;

  estado_envio_correo:
    EstadoEnvioCorreo;

  leida: boolean;

  fecha_leida:
    Date | null;

  fecha_creacion:
    Date;
}

export interface NotificacionResponse {
  id_notificacion: string;
  id_actor: string;
  id_proyecto: string;
  id_incidencia: string | null;

  tipo: string;
  titulo: string;
  mensaje: string;

  destino:
    DestinoNotificacion | null;

  id_recurso:
    string | null;

  leida: boolean;

  fecha_leida:
    string | null;

  fecha_creacion:
    string;
}