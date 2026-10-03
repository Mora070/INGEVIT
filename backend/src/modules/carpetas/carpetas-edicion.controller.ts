import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
  ActualizarCarpetaDto,
} from './dto/actualizar-carpeta.dto';

import {
  MoverCarpetaDto,
} from './dto/mover-carpeta.dto';

import {
  CarpetasActualizacionService,
} from '../carpetas/carpetas-actualizacion.service';

import {
  CarpetasMovimientoService,
} from './carpetas-movimiento.service';

import type {
  CarpetaResponse,
} from './types/carpeta.types';


/**
 * Expone operaciones de edición
 * sobre la estructura de carpetas.
 */
@Controller(
  'proyectos/:idProyecto/carpetas',
)
@UseGuards(
  AuthGuard,
)
export class CarpetasEdicionController {
  constructor(
    private readonly actualizacionService:
      CarpetasActualizacionService,

    private readonly movimientoService:
      CarpetasMovimientoService,
  ) {}

  /**
   * Renombra una carpeta.
   */
  @Patch(
    ':idCarpeta',
  )
  @HttpCode(
    HttpStatus.OK,
  )
  @Header(
    'Cache-Control',
    'no-store',
  )
  async renombrar(
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

    @Body()
    datos:
      ActualizarCarpetaDto,
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

    return this.actualizacionService.renombrar(
      idProyecto,
      idCarpeta,
      usuario.id_usuario,
      datos,
    );
  }


  /**
   * Mueve una carpeta a otra ubicación
   * dentro del mismo proyecto.
   *
   * id_carpeta_padre = null
   * mueve la carpeta a la raíz.
   */
  @Patch(
    ':idCarpeta/mover',
  )
  @HttpCode(
    HttpStatus.OK,
  )
  @Header(
    'Cache-Control',
    'no-store',
  )
  async mover(
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

    @Body()
    datos:
      MoverCarpetaDto,
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

    return this.movimientoService.mover(
      idProyecto,
      idCarpeta,
      usuario.id_usuario,
      datos,
    );
  }
}