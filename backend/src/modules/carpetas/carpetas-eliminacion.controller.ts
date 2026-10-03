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

import {
  AuthGuard,
} from '../auth/guards/auth.guard';

import type {
  AuthRequest,
} from '../auth/types/auth-request.types';

import {
  CarpetasEliminacionService,
} from './carpetas-eliminacion.service';

import type {
  CarpetaResponse,
} from './types/carpeta.types';


/**
 * Expone la eliminación de carpetas
 * y subcarpetas del proyecto.
 *
 * La eliminación afecta únicamente
 * la estructura organizativa.
 *
 * Las fotografías, panorámicas y planos
 * originales permanecen intactos.
 */
@Controller(
  'proyectos/:idProyecto/carpetas',
)
@UseGuards(
  AuthGuard,
)
export class CarpetasEliminacionController {
  constructor(
    private readonly eliminacionService:
      CarpetasEliminacionService,
  ) {}

  /**
   * Elimina una carpeta.
   *
   * PostgreSQL eliminará también:
   * - sus subcarpetas;
   * - sus relaciones con fotografías;
   * - sus relaciones con panorámicas;
   * - sus relaciones con planos.
   */
  @Delete(
    ':idCarpeta',
  )
  @HttpCode(
    HttpStatus.OK,
  )
  @Header(
    'Cache-Control',
    'no-store',
  )
  async eliminar(
    @Param(
      'idProyecto',
      new ParseUUIDPipe(),
    )
    idProyecto: string,

    @Param(
      'idCarpeta',
      new ParseUUIDPipe(),
    )
    idCarpeta: string,

    @Req()
    request: AuthRequest,
  ): Promise<CarpetaResponse> {
    const usuario =
      request.usuario;

    if (
      !usuario
    ) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.eliminacionService.eliminar(
      idProyecto,
      idCarpeta,
      usuario.id_usuario,
    );
  }
}