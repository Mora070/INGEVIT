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

import { PlanosSubidaService } from './planos-subida.service';
import { SubirPlanoDto } from './dto/subir-plano.dto';
import { ContenidoPlanoPipe } from './pipes/contenido-plano.pipe';
import { getSubidaPlanoConfig } from './config/subida-plano.config';
import type { PlanoResponse } from './types/plano.types';

/**
 * Recibe un PDF mediante multipart/form-data.
 *
 * El guard autentica antes de ejecutar el interceptor de archivos.
 * El servicio comprueba los permisos sobre el proyecto e interpreta
 * el contenido real del PDF.
 */
@Controller('proyectos/:idProyecto/planos')
@UseGuards(AuthGuard)
export class PlanosSubidaController {
  constructor(
    private readonly subida: PlanosSubidaService,
  ) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    FileInterceptor('archivo', getSubidaPlanoConfig()),
  )
  async subir(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Req() request: AuthRequest,
    @Body() datos: SubirPlanoDto,
    @UploadedFile(new ContenidoPlanoPipe()) contenido: Buffer,
  ): Promise<PlanoResponse> {
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