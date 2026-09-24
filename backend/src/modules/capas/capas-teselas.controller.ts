import {
  Controller, Get, Header, Param, ParseUUIDPipe, Req,
  StreamableFile, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';
import { CapasTeselasService } from './capas-teselas.service';

/** Las teselas conservan los permisos del proyecto; no son contenido público. */
@Controller('proyectos/:idProyecto/capas/:idCapa/teselas')
@UseGuards(AuthGuard)
export class CapasTeselasController {
  constructor(private readonly servicio: CapasTeselasService) {}

  @Get(':version/:z/:x/:archivo')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async obtener(
    @Param('idProyecto', new ParseUUIDPipe()) proyecto: string,
    @Param('idCapa', new ParseUUIDPipe()) capa: string,
    @Param('version', new ParseUUIDPipe()) version: string,
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('archivo') archivo: string,
    @Req() request: AuthRequest,
  ): Promise<StreamableFile> {
    if (!request.usuario) {
      throw new UnauthorizedException('La sesión no es válida o ha expirado.');
    }
    const contenido = await this.servicio.obtener(
      proyecto, capa, version, request.usuario.id_usuario, z, x, archivo,
    );
    return new StreamableFile(contenido, {
      type: 'image/png', disposition: 'inline', length: contenido.length,
    });
  }
}
