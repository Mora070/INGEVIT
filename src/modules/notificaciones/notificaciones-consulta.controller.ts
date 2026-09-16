import {
  Controller,
  Get,
  Header,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';

import {
  NotificacionesConsultaService,
} from './notificaciones-consulta.service';
import {
  ListarNotificacionesQueryDto,
} from './dto/listar-notificaciones-query.dto';

/**
 * Expone el historial disponible para el usuario autenticado.
 * No permite consultar el historial de otro receptor.
 */
@Controller('notificaciones')
@UseGuards(AuthGuard)
export class NotificacionesConsultaController {
  constructor(
    private readonly consulta: NotificacionesConsultaService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async listar(
    @Req() request: AuthRequest,
    @Query() parametros: ListarNotificacionesQueryDto,
  ) {
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.consulta.listar(
      usuario.id_usuario,
      parametros,
    );
  }
}