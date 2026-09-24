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
  IncidenciasMapaEliminacionService,
} from './incidencias-mapa-eliminacion.service';

/** Obtiene la identidad del creador desde la sesión autenticada. */
@Controller('proyectos/:idProyecto/incidencias/mapa')
@UseGuards(AuthGuard)
export class IncidenciasMapaEliminacionController {
  constructor(
    private readonly eliminacion: IncidenciasMapaEliminacionService,
  ) {}

  @Delete(':idIncidencia')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async eliminar(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Param('idIncidencia', new ParseUUIDPipe())
    idIncidencia: string,
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
      idIncidencia,
      usuario.id_usuario,
    );
  }
}