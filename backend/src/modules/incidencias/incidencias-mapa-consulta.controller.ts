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
  IncidenciasMapaConsultaService,
} from './incidencias-mapa-consulta.service';
import {
  ListarIncidenciasMapaQueryDto,
} from './dto/listar-incidencias-mapa-query.dto';

/** Lista incidencias de mapa utilizando la identidad de la sesión. */
@Controller('proyectos/:idProyecto/incidencias/mapa')
@UseGuards(AuthGuard)
export class IncidenciasMapaConsultaController {
  constructor(
    private readonly consulta: IncidenciasMapaConsultaService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async listar(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Req() request: AuthRequest,
    @Query() parametros: ListarIncidenciasMapaQueryDto,
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