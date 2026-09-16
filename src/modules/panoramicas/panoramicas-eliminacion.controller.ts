import {
  Controller,
  Delete,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';

import {
  PanoramicasEliminacionService,
} from './panoramicas-eliminacion.service';

@Controller('proyectos/:idProyecto/panoramicas')
@UseGuards(AuthGuard)
export class PanoramicasEliminacionController {
  constructor(
    private readonly eliminacion: PanoramicasEliminacionService,
  ) {}

  @Delete(':idPanoramica')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async eliminar(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Param('idPanoramica', new ParseUUIDPipe())
    idPanoramica: string,
    @Req() request: AuthRequest,
  ): Promise<void> {
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    await this.eliminacion.eliminar(
      idProyecto,
      idPanoramica,
      usuario.id_usuario,
    );
  }
}