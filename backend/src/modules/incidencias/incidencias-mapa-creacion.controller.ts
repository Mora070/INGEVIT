import {
  Body,
  Controller,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';

import {
  IncidenciasMapaCreacionService,
} from './incidencias-mapa-creacion.service';
import {
  CrearIncidenciaMapaDto,
} from './dto/crear-incidencia-mapa.dto';
import type {
  IncidenciaMapaResponse,
} from './mappers/incidencia-mapa.mapper';

/**
 * Crea una incidencia directamente en el mapa del proyecto.
 *
 * El DTO valida el contenido JSON.
 * El creador se obtiene exclusivamente de la sesión autenticada.
 * El servicio comprueba el acceso al proyecto y administra la operación.
 */
@Controller('proyectos/:idProyecto/incidencias/mapa')
@UseGuards(AuthGuard)
export class IncidenciasMapaCreacionController {
  constructor(
    private readonly creacion: IncidenciasMapaCreacionService,
  ) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  async crear(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Req() request: AuthRequest,
    @Body() datos: CrearIncidenciaMapaDto,
  ): Promise<IncidenciaMapaResponse> {
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.creacion.crear(
      idProyecto,
      usuario.id_usuario,
      datos,
    );
  }
}