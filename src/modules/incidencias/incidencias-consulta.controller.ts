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
  IncidenciasConsultaService,
} from './incidencias-consulta.service';

import {
  ListarIncidenciasQueryDto,
} from './dto/listar-incidencias-query.dto';

/**
 * Consulta las incidencias de una página del PDF.
 *
 * numero_pagina identifica la página del documento.
 * pagina y limite controlan la paginación de las incidencias.
 */
@Controller('proyectos/:idProyecto/planos/:idPlano/incidencias')
@UseGuards(AuthGuard)
export class IncidenciasConsultaController {
  constructor(
    private readonly consulta: IncidenciasConsultaService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async listar(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Param('idPlano', new ParseUUIDPipe())
    idPlano: string,
    @Req() request: AuthRequest,
    @Query() parametros: ListarIncidenciasQueryDto,
  ) {
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.consulta.listar(
      idProyecto,
      idPlano,
      usuario.id_usuario,
      parametros,
    );
  }
}