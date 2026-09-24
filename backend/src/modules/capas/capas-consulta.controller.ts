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

import { CapasConsultaService } from './capas-consulta.service';
import { ListarCapasQueryDto } from './dto/listar-capas-query.dto';

/** Consulta capas con la identidad de la sesión autenticada. */
@Controller('proyectos/:idProyecto/capas')
@UseGuards(AuthGuard)
export class CapasConsultaController {
  constructor(
    private readonly consulta: CapasConsultaService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async listar(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Req() request: AuthRequest,
    @Query() parametros: ListarCapasQueryDto,
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