import { Injectable } from '@nestjs/common';

import {
  Observable,
  Subject,
} from 'rxjs';

export type TipoEventoProyecto =
  | 'FOTOGRAFIAS'
  | 'PANORAMICAS'
  | 'PLANOS'
  | 'ORTOFOTOS'
  | 'INCIDENCIAS'
  | 'CARPETAS';

export interface EventoNotificacion {
  tipo:
    'NOTIFICACION';

  id_usuario:
    string;
}

export interface EventoProyecto {
  tipo:
    'PROYECTO';

  id_usuario:
    string;

  id_proyecto:
    string;

  recurso:
    TipoEventoProyecto;
}

type EventoTiempoReal =
  | EventoNotificacion
  | EventoProyecto;

@Injectable()
export class NotificacionesEventosService {
  private readonly eventos =
    new Subject<EventoTiempoReal>();

  emitir(
    idUsuario: string,
  ): void {
    this.eventos.next({
      tipo:
        'NOTIFICACION',

      id_usuario:
        idUsuario,
    });
  }

  emitirProyecto(
    idUsuario: string,
    idProyecto: string,
    recurso: TipoEventoProyecto,
  ): void {
    this.eventos.next({
      tipo:
        'PROYECTO',

      id_usuario:
        idUsuario,

      id_proyecto:
        idProyecto,

      recurso,
    });
  }

  escuchar(
    idUsuario: string,
  ): Observable<EventoTiempoReal> {
    return new Observable(
      (suscriptor) => {
        const subscripcion =
          this.eventos.subscribe(
            (evento) => {
              if (
                evento.id_usuario !==
                idUsuario
              ) {
                return;
              }

              suscriptor.next(
                evento,
              );
            },
          );

        return () => {
          subscripcion.unsubscribe();
        };
      },
    );
  }
}