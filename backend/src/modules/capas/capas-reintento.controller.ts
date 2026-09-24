import {
  Controller, Header, HttpCode, Param, ParseUUIDPipe, Post, Req,
  UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';
import { CapasReintentoService } from './capas-reintento.service';

/** El propietario solicita el trabajo; el trabajador existente lo ejecuta. */
@Controller('proyectos/:idProyecto/capas')
@UseGuards(AuthGuard)
export class CapasReintentoController {
  constructor(private readonly servicio: CapasReintentoService) {}

  @Post(':idCapa/reintentar')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  async solicitar(
    @Param('idProyecto', new ParseUUIDPipe()) proyecto: string,
    @Param('idCapa', new ParseUUIDPipe()) capa: string,
    @Req() request: AuthRequest,
  ) {
    if (!request.usuario) {
      throw new UnauthorizedException('La sesión no es válida o ha expirado.');
    }
    return this.servicio.solicitar(proyecto, capa, request.usuario.id_usuario);
  }
}
