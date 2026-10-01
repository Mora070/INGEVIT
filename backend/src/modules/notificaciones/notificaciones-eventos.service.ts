import { Injectable } from '@nestjs/common';
import {
  Observable,
  Subject,
} from 'rxjs';

export interface EventoNotificacion {
  id_usuario: string;
}

@Injectable()
export class NotificacionesEventosService {
  private readonly eventos =
    new Subject<EventoNotificacion>();

  emitir(
    idUsuario: string,
  ): void {
    this.eventos.next({
      id_usuario: idUsuario,
    });
  }

  escuchar(
    idUsuario: string,
  ): Observable<EventoNotificacion> {
    return new Observable(
      (suscriptor) => {
        const subscripcion =
          this.eventos.subscribe(
            (evento) => {
              if (
                evento.id_usuario ===
                idUsuario
              ) {
                suscriptor.next(
                  evento,
                );
              }
            },
          );

        return () => {
          subscripcion.unsubscribe();
        };
      },
    );
  }
}