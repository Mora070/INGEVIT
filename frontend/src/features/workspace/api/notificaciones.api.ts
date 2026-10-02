import {
  http,
} from '../../../shared/api/http';

export type DestinoNotificacion =
  | 'RESUMEN'
  | 'FOTOGRAFIAS'
  | 'PLANOS'
  | 'PANORAMICAS'
  | 'MAPA'
  | 'CAPAS'
  | 'COLABORADORES';

export interface Notificacion {
  id_notificacion: string;

  id_actor: string;

  id_proyecto: string;

  nombre_proyecto: string;

  id_incidencia:
    string | null;

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

export interface ListaNotificacionesResponse {
  notificaciones:
    Notificacion[];

  pagina: number;

  limite: number;

  total: number;

  total_paginas: number;
}

export interface ConteoNoLeidasResponse {
  total: number;
}

export interface VigenciaNotificacionResponse {
  vigente: boolean;
}

export function listarNotificaciones(
  pagina = 1,
  limite = 20,
) {
  return http<ListaNotificacionesResponse>(
    `/api/notificaciones?pagina=${pagina}&limite=${limite}`,
  );
}

export function obtenerConteoNoLeidas() {
  return http<ConteoNoLeidasResponse>(
    '/api/notificaciones/no-leidas/conteo',
  );
}

export function marcarNotificacionLeida(
  idNotificacion: string,
) {
  return http<{
    ok: boolean;
  }>(
    `/api/notificaciones/${encodeURIComponent(
      idNotificacion,
    )}/leida`,
    {
      method:
        'PATCH',
    },
  );
}

export function marcarTodasNotificacionesLeidas() {
  return http<{
    actualizadas: number;
  }>(
    '/api/notificaciones/leidas',
    {
      method:
        'PATCH',
    },
  );
}

export function eliminarNotificacion(
  idNotificacion: string,
) {
  return http<{
    ok: boolean;
  }>(
    `/api/notificaciones/${encodeURIComponent(
      idNotificacion,
    )}`,
    {
      method:
        'DELETE',
    },
  );
}

export function comprobarVigenciaNotificacion(
  idNotificacion: string,
) {
  return http<VigenciaNotificacionResponse>(
    `/api/notificaciones/${encodeURIComponent(
      idNotificacion,
    )}/vigencia`,
  );
}