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
  IncidenciasEliminacionService,
} from './incidencias-eliminacion.service';

/** El creador se obtiene de la sesión, nunca de un campo del cliente. */
@Controller('proyectos/:idProyecto/planos/:idPlano/incidencias')
@UseGuards(AuthGuard)
export class IncidenciasEliminacionController {
  constructor(
    private readonly eliminacion: IncidenciasEliminacionService,
  ) {}

  @Delete(':idIncidencia')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async eliminar(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Param('idPlano', new ParseUUIDPipe())
    idPlano: string,
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
      idPlano,
      idIncidencia,
      usuario.id_usuario,
    );
  }
}