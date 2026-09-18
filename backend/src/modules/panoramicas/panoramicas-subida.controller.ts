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
import { FileInterceptor } from '@nestjs/platform-express';

import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';

import { PanoramicasSubidaService } from './panoramicas-subida.service';
import { SubirPanoramicaDto } from './dto/subir-panoramica.dto';
import { ContenidoPanoramicaPipe } from './pipes/contenido-panoramica.pipe';
import { getSubidaPanoramicaConfig } from './config/subida-panoramica.config';
import type { PanoramicaResponse } from './types/panoramica.types';

/**
 * Recibe un archivo y su título mediante multipart/form-data.
 *
 * El guard autentica antes de recibir el archivo.
 * El servicio comprueba acceso, formato e integridad.
 */
@Controller('proyectos/:idProyecto/panoramicas')
@UseGuards(AuthGuard)
export class PanoramicasSubidaController {
  constructor(
    private readonly subida: PanoramicasSubidaService,
  ) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    FileInterceptor('archivo', getSubidaPanoramicaConfig()),
  )
  async subir(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Req() request: AuthRequest,
    @Body() datos: SubirPanoramicaDto,
    @UploadedFile(new ContenidoPanoramicaPipe())
    contenido: Buffer,
  ): Promise<PanoramicaResponse> {
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.subida.subir(
      idProyecto,
      usuario.id_usuario,
      datos,
      contenido,
    );
  }
}