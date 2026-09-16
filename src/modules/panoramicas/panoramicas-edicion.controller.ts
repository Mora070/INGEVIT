import {
  Body,
  Controller,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';

import { PanoramicasEdicionService } from './panoramicas-edicion.service';
import { ActualizarPanoramicaDto } from './dto/actualizar-panoramica.dto';

@Controller('proyectos/:idProyecto/panoramicas')
@UseGuards(AuthGuard)
export class PanoramicasEdicionController {
  constructor(
    private readonly edicion: PanoramicasEdicionService,
  ) {}

  @Patch(':idPanoramica/titulo')
  @Header('Cache-Control', 'no-store')
  async actualizar(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Param('idPanoramica', new ParseUUIDPipe())
    idPanoramica: string,
    @Req() request: AuthRequest,
    @Body() datos: ActualizarPanoramicaDto,
  ) {
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.edicion.actualizarTitulo(
      idProyecto,
      idPanoramica,
      usuario.id_usuario,
      datos.titulo,
    );
  }
}