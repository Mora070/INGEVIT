import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';

import {
  PanoramicasConsultaService,
} from './panoramicas-consulta.service';
import {
  ListarPanoramicasQueryDto,
} from './dto/listar-panoramicas-query.dto';

@Controller('proyectos/:idProyecto/panoramicas')
@UseGuards(AuthGuard)
export class PanoramicasConsultaController {
  constructor(
    private readonly consulta: PanoramicasConsultaService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async listar(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Req() request: AuthRequest,
    @Query() parametros: ListarPanoramicasQueryDto,
  ) {
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.consulta.listar(
      idProyecto,
      usuario.id_usuario,
      parametros,
    );
  }
}