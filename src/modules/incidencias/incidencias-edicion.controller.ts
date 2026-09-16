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

import { IncidenciasEdicionService } from './incidencias-edicion.service';
import { ActualizarIncidenciaDto } from './dto/actualizar-incidencia.dto';
import type { IncidenciaResponse } from './mappers/incidencia.mapper';

/**
 * Recibe los cuatro campos editables.
 * La identidad del editor procede exclusivamente de la sesión.
 */
@Controller('proyectos/:idProyecto/planos/:idPlano/incidencias')
@UseGuards(AuthGuard)
export class IncidenciasEdicionController {
  constructor(
    private readonly edicion: IncidenciasEdicionService,
  ) {}

  @Patch(':idIncidencia')
  @Header('Cache-Control', 'no-store')
  async actualizar(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Param('idPlano', new ParseUUIDPipe())
    idPlano: string,
    @Param('idIncidencia', new ParseUUIDPipe())
    idIncidencia: string,
    @Req() request: AuthRequest,
    @Body() datos: ActualizarIncidenciaDto,
  ): Promise<IncidenciaResponse> {
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.edicion.actualizarDatos(
      idProyecto,
      idPlano,
      idIncidencia,
      usuario.id_usuario,
      datos,
    );
  }
}