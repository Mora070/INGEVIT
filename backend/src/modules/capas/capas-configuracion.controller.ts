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

import { CapasConfiguracionService } from './capas-configuracion.service';
import {
  ActualizarConfiguracionCapaDto,
} from './dto/actualizar-configuracion-capa.dto';

/** Recibe la presentación compartida; el servicio verifica la propiedad. */
@Controller('proyectos/:idProyecto/capas')
@UseGuards(AuthGuard)
export class CapasConfiguracionController {
  constructor(
    private readonly configuracion: CapasConfiguracionService,
  ) {}

  @Patch(':idCapa/configuracion')
  @Header('Cache-Control', 'no-store')
  async actualizar(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Param('idCapa', new ParseUUIDPipe())
    idCapa: string,
    @Req() request: AuthRequest,
    @Body() datos: ActualizarConfiguracionCapaDto,
  ) {
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.configuracion.actualizar(
      idProyecto,
      idCapa,
      usuario.id_usuario,
      datos,
    );
  }
}