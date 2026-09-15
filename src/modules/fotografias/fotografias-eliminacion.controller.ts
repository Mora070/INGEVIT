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
  FotografiasEliminacionService,
} from './fotografias-eliminacion.service';

/**
 * Expone la eliminación de fotografías.
 *
 * AuthGuard obtiene la identidad de la sesión.
 * El servicio comprueba los permisos sobre el proyecto.
 * La protección global de origen se aplica a la solicitud DELETE.
 */
@Controller('proyectos/:idProyecto/fotografias')
@UseGuards(AuthGuard)
export class FotografiasEliminacionController {
  constructor(
    private readonly eliminacionService: FotografiasEliminacionService,
  ) {}

  /**
   * Elimina el registro y deja programado el borrado de ambas versiones.
   *
   * No recibe claves de almacenamiento ni identidades en el cuerpo.
   * Los identificadores proceden de la ruta y el actor de la sesión.
   *
   * HTTP 204 confirma la operación en PostgreSQL.
   * No significa que los archivos físicos ya hayan sido eliminados.
   */
  @Delete(':idFotografia')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async eliminar(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Param('idFotografia', new ParseUUIDPipe())
    idFotografia: string,
    @Req() request: AuthRequest,
  ): Promise<void> {
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    await this.eliminacionService.eliminar(
      idProyecto,
      idFotografia,
      usuario.id_usuario,
    );
  }
}