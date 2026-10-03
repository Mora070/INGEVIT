import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
  CrearCarpetaDto,
} from './dto/crear-carpeta.dto';

import {
  CarpetasCreacionService,
} from '../carpetas/carpetas-creacion.service';

import type {
  CarpetaResponse,
} from './types/carpeta.types';


/**
 * Expone la creación de carpetas
 * y subcarpetas dentro de un proyecto.
 *
 * AuthGuard establece la identidad
 * del usuario autenticado.
 *
 * El servicio comprueba que el usuario
 * sea propietario o colaborador activo
 * del proyecto.
 */
@Controller(
  'proyectos/:idProyecto/carpetas',
)
@UseGuards(
  AuthGuard,
)
export class CarpetasCreacionController {
  constructor(
    private readonly creacionService:
      CarpetasCreacionService,
  ) {}

  /**
   * Crea una carpeta raíz o una subcarpeta.
   *
   * Para una carpeta raíz:
   *
   * {
   *   "nombre": "Edificio 1"
   * }
   *
   * Para una subcarpeta:
   *
   * {
   *   "nombre": "Piso 1",
   *   "id_carpeta_padre": "uuid"
   * }
   */
  @Post()
  @HttpCode(
    HttpStatus.CREATED,
  )
  @Header(
    'Cache-Control',
    'no-store',
  )
  async crear(
    @Param(
      'idProyecto',
      new ParseUUIDPipe(),
    )
    idProyecto: string,

    @Req()
    request: AuthRequest,

    @Body()
    datos:
      CrearCarpetaDto,
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

    return this.creacionService.crear(
      idProyecto,
      usuario.id_usuario,
      datos,
    );
  }
}