import {
  Controller,
  Delete,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';
import { CapasEliminacionService } from './capas-eliminacion.service';

@Controller('proyectos/:idProyecto/capas')
@UseGuards(AuthGuard)
export class CapasEliminacionController {
  constructor(private readonly servicio: CapasEliminacionService) {}

  @Delete(':idCapa')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async eliminar(
    @Param('idProyecto', new ParseUUIDPipe()) proyecto: string,
    @Param('idCapa', new ParseUUIDPipe()) capa: string,
    @Req() request: AuthRequest,
  ): Promise<void> {
    if (!request.usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    await this.servicio.eliminar(
      proyecto,
      capa,
      request.usuario.id_usuario,
    );
  }
}