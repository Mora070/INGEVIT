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

import {
  IncidenciasMapaEdicionService,
} from './incidencias-mapa-edicion.service';
import {
  ActualizarIncidenciaDto,
} from './dto/actualizar-incidencia.dto';

/**
 * Edita los datos descriptivos de una incidencia de mapa.
 * La identidad del editor procede exclusivamente de la sesión.
 */
@Controller('proyectos/:idProyecto/incidencias/mapa')
@UseGuards(AuthGuard)
export class IncidenciasMapaEdicionController {
  constructor(
    private readonly edicion: IncidenciasMapaEdicionService,
  ) {}

  @Patch(':idIncidencia')
  @Header('Cache-Control', 'no-store')
  async actualizar(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Param('idIncidencia', new ParseUUIDPipe())
    idIncidencia: string,
    @Req() request: AuthRequest,
    @Body() datos: ActualizarIncidenciaDto,
  ) {
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.edicion.actualizarDatos(
      idProyecto,
      idIncidencia,
      usuario.id_usuario,
      datos,
    );
  }
}