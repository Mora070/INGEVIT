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
  IncidenciasCreacionService,
} from './incidencias-creacion.service';
import { CrearIncidenciaDto } from './dto/crear-incidencia.dto';
import type { IncidenciaResponse } from './mappers/incidencia.mapper';

/**
 * Recibe los datos de una incidencia vinculada a una página del plano.
 *
 * El creador procede de la sesión, no del cuerpo de la petición.
 * El servicio comprueba acceso, pertenencia del plano y página.
 */
@Controller('proyectos/:idProyecto/planos/:idPlano/incidencias')
@UseGuards(AuthGuard)
export class IncidenciasCreacionController {
  constructor(
    private readonly creacion: IncidenciasCreacionService,
  ) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  async crear(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Param('idPlano', new ParseUUIDPipe())
    idPlano: string,
    @Req() request: AuthRequest,
    @Body() datos: CrearIncidenciaDto,
  ): Promise<IncidenciaResponse> {
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.creacion.crear(
      idProyecto,
      idPlano,
      usuario.id_usuario,
      datos,
    );
  }
}