import {
  Body,
  Controller,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type {} from 'multer';

import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';

import { PropietarioCapaGuard } from './guards/propietario-capa.guard';
import {
  crearInterceptorSubidaCapa,
} from './interceptors/subida-capa.interceptor';
import { CapasSubidaService } from './capas-subida.service';
import { SubirCapaDto } from './dto/subir-capa.dto';
import type { CapaResponse } from './types/capa.types';

/**
 * Recibe un GeoTIFF y registra su original para procesamiento.
 *
 * Orden:
 * autenticación -> permiso del propietario -> recepción -> validación
 * -> inspección -> persistencia -> limpieza del temporal.
 */
@Controller('proyectos/:idProyecto/capas')
@UseGuards(AuthGuard, PropietarioCapaGuard)
export class CapasSubidaController {
  constructor(
    private readonly subida: CapasSubidaService,
  ) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(crearInterceptorSubidaCapa())
  async subir(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Req() request: AuthRequest,
    @Body() datos: SubirCapaDto,
    @UploadedFile() archivo: Express.Multer.File | undefined,
  ): Promise<CapaResponse> {
    if (!request.usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.subida.subir(
      idProyecto,
      request.usuario.id_usuario,
      datos,
      archivo,
    );
  }
}