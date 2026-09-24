import {
  Controller, Get, Header, Param, ParseUUIDPipe, Req,
  UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';
import { CapasTilejsonService } from './capas-tilejson.service';

@Controller('proyectos/:idProyecto/capas/:idCapa/teselas')
@UseGuards(AuthGuard)
export class CapasTilejsonController {
  constructor(private readonly servicio: CapasTilejsonService) {}

  @Get(':version/tilejson.json')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async obtener(
    @Param('idProyecto', new ParseUUIDPipe()) proyecto: string,
    @Param('idCapa', new ParseUUIDPipe()) capa: string,
    @Param('version', new ParseUUIDPipe()) version: string,
    @Req() request: AuthRequest,
  ) {
    if (!request.usuario) {
      throw new UnauthorizedException('La sesión no es válida o ha expirado.');
    }
    return this.servicio.obtener(proyecto, capa, version, request.usuario.id_usuario);
  }
}
