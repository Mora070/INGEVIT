import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
} from '../auth/guards/auth.guard';

import type {
  AuthRequest,
} from '../auth/types/auth-request.types';

import {
  NotificacionesLecturaService,
} from './notificaciones-lectura.service';

@Controller('notificaciones')
@UseGuards(AuthGuard)
export class NotificacionesLecturaController {
  constructor(
    private readonly lectura:
      NotificacionesLecturaService,
  ) {}

  @Get('no-leidas/conteo')
  @Header(
    'Cache-Control',
    'no-store',
  )
  async contarNoLeidas(
    @Req()
    request: AuthRequest,
  ) {
    const usuario =
      request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.lectura.contarNoLeidas(
      usuario.id_usuario,
    );
  }

  @Patch(':idNotificacion/leida')
  async marcarLeida(
    @Req()
    request: AuthRequest,

    @Param(
      'idNotificacion',
      new ParseUUIDPipe(),
    )
    idNotificacion: string,
  ) {
    const usuario =
      request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.lectura.marcarLeida(
      usuario.id_usuario,
      idNotificacion,
    );
  }

  @Patch('leidas')
  async marcarTodasLeidas(
    @Req()
    request: AuthRequest,
  ) {
    const usuario =
      request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.lectura.marcarTodasLeidas(
      usuario.id_usuario,
    );
  }
}