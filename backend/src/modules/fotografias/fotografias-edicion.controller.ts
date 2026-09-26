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

import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';

import {
  ActualizarTituloFotografiaDto,
} from './dto/actualizar-titulo-fotografia.dto';

import {
  FotografiasEdicionService,
} from './fotografias-edicion.service';

import type {
  FotografiaResponse,
} from './types/fotografia.types';

/**
 * Expone la edición de metadatos de fotografías.
 *
 * AuthGuard establece la identidad del solicitante.
 * El servicio comprueba los permisos sobre el proyecto
 * y coordina las actualizaciones con su actividad.
 */
@Controller('proyectos/:idProyecto/fotografias')
@UseGuards(AuthGuard)
export class FotografiasEdicionController {
  constructor(
    private readonly edicionService:
      FotografiasEdicionService,
  ) {}

  /**
   * Guarda el título y devuelve los metadatos públicos actualizados.
   *
   * Recibe JSON con la propiedad titulo.
   * Los identificadores proceden de la ruta y el usuario de la sesión.
   *
   * El ValidationPipe global rechaza campos adicionales.
   * La protección global de origen debe aplicarse a este PATCH.
   */
  @Patch(':idFotografia/titulo')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async actualizarTitulo(
    @Param(
      'idProyecto',
      new ParseUUIDPipe(),
    )
    idProyecto: string,

    @Param(
      'idFotografia',
      new ParseUUIDPipe(),
    )
    idFotografia: string,

    @Req()
    request: AuthRequest,

    @Body()
    datos:
      ActualizarTituloFotografiaDto,
  ): Promise<FotografiaResponse> {
    const usuario =
      request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.edicionService.actualizarTitulo(
      idProyecto,
      idFotografia,
      usuario.id_usuario,
      datos,
    );
  }

  /**
   * Selecciona una fotografía como portada del proyecto.
   *
   * Solo el propietario del proyecto puede realizar esta operación.
   *
   * No recibe body:
   * - idProyecto procede de la ruta;
   * - idFotografia procede de la ruta;
   * - idUsuario procede de la sesión autenticada.
   */
  @Patch(':idFotografia/portada')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async establecerPortada(
    @Param(
      'idProyecto',
      new ParseUUIDPipe(),
    )
    idProyecto: string,

    @Param(
      'idFotografia',
      new ParseUUIDPipe(),
    )
    idFotografia: string,

    @Req()
    request: AuthRequest,
  ): Promise<FotografiaResponse> {
    const usuario =
      request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.edicionService.establecerPortada(
      idProyecto,
      idFotografia,
      usuario.id_usuario,
    );
  }
}