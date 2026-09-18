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
  PlanosEliminacionService,
} from './planos-eliminacion.service';

/**
 * Expone la eliminación del plano y sus incidencias asociadas.
 *
 * La identidad procede de la sesión autenticada.
 * El servicio comprueba el acceso y coordina la transacción.
 *
 * El 204 confirma la operación en PostgreSQL; la eliminación física
 * del PDF se completa posteriormente mediante la cola.
 */
@Controller('proyectos/:idProyecto/planos')
@UseGuards(AuthGuard)
export class PlanosEliminacionController {
  constructor(
    private readonly eliminacion: PlanosEliminacionService,
  ) {}

  @Delete(':idPlano')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async eliminar(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Param('idPlano', new ParseUUIDPipe())
    idPlano: string,
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
      usuario.id_usuario,
    );
  }
}