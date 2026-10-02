import {
  Controller,
  Delete,
  Get,
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
    private readonly service:
      NotificacionesLecturaService,
  ) {}

  @Get('no-leidas/conteo')
  async contarNoLeidas(
    @Req()
    request: AuthRequest,
  ): Promise<{
    total: number;
  }> {
    const usuario =
      request.usuario;

    if (
      !usuario
    ) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    const total =
      await this.service.contarNoLeidas(
        usuario.id_usuario,
      );

    return {
      total,
    };
  }

  @Patch(':idNotificacion/leida')
  async marcarLeida(
    @Req()
    request: AuthRequest,

    @Param(
      'idNotificacion',
      new ParseUUIDPipe({
        version:
          '4',
      }),
    )
    idNotificacion: string,
  ): Promise<{
    ok: true;
  }> {
    const usuario =
      request.usuario;

    if (
      !usuario
    ) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    await this.service.marcarLeida(
      usuario.id_usuario,
      idNotificacion,
    );

    return {
      ok:
        true,
    };
  }

  @Patch('leidas')
  async marcarTodasLeidas(
    @Req()
    request: AuthRequest,
  ): Promise<{
    actualizadas: number;
  }> {
    const usuario =
      request.usuario;

    if (
      !usuario
    ) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    const actualizadas =
      await this.service.marcarTodasLeidas(
        usuario.id_usuario,
      );

    return {
      actualizadas,
    };
  }

  @Delete(':idNotificacion')
  async eliminar(
    @Req()
    request: AuthRequest,

    @Param(
      'idNotificacion',
      new ParseUUIDPipe({
        version:
          '4',
      }),
    )
    idNotificacion: string,
  ): Promise<{
    ok: true;
  }> {
    const usuario =
      request.usuario;

    if (
      !usuario
    ) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    await this.service.eliminar(
      usuario.id_usuario,
      idNotificacion,
    );

    return {
      ok:
        true,
    };
  }
}