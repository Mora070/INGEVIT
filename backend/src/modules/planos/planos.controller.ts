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

import { PlanosService } from './planos.service';
import { ListarPlanosQueryDto } from './dto/listar-planos-query.dto';

import type {
  PlanosPaginadosResponse,
} from './types/planos-paginados.types';

/**
 * Consulta metadatos. No descarga ni modifica archivos PDF.
 */
@Controller('proyectos/:idProyecto/planos')
@UseGuards(AuthGuard)
export class PlanosController {
  constructor(
    private readonly planosService: PlanosService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async listar(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Req() request: AuthRequest,
    @Query() consulta: ListarPlanosQueryDto,
  ): Promise<PlanosPaginadosResponse> {
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.planosService.listarDisponibles(
      idProyecto,
      usuario.id_usuario,
      consulta,
    );
  }
}