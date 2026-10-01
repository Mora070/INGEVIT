import {
  Controller,
  MessageEvent,
  Req,
  Sse,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import {
  map,
  Observable,
} from 'rxjs';

import {
  AuthGuard,
} from '../auth/guards/auth.guard';

import type {
  AuthRequest,
} from '../auth/types/auth-request.types';

import {
  NotificacionesEventosService,
} from './notificaciones-eventos.service';

@Controller('notificaciones')
@UseGuards(AuthGuard)
export class NotificacionesEventosController {
  constructor(
    private readonly eventos:
      NotificacionesEventosService,
  ) {}

  @Sse('eventos')
  escuchar(
    @Req()
    request: AuthRequest,
  ): Observable<MessageEvent> {
    const usuario =
      request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.eventos
      .escuchar(
        usuario.id_usuario,
      )
      .pipe(
        map(() => ({
          type: 'notificacion',
          data: {
            actualizar: true,
          },
        })),
      );
  }
}