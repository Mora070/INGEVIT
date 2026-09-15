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

import { PlanosEdicionService } from './planos-edicion.service';
import { ActualizarPlanoDto } from './dto/actualizar-plano.dto';
import type { PlanoResponse } from './types/plano.types';

/**
 * Expone la edición descriptiva del plano.
 *
 * La identidad procede de la sesión. El servicio comprueba
 * la pertenencia al proyecto y registra la actividad.
 *
 * La validación global rechaza campos adicionales.
 */
@Controller('proyectos/:idProyecto/planos')
@UseGuards(AuthGuard)
export class PlanosEdicionController {
  constructor(
    private readonly edicion: PlanosEdicionService,
  ) {}

  @Patch(':idPlano')
  @Header('Cache-Control', 'no-store')
  async actualizar(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Param('idPlano', new ParseUUIDPipe())
    idPlano: string,
    @Req() request: AuthRequest,
    @Body() datos: ActualizarPlanoDto,
  ): Promise<PlanoResponse> {
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.edicion.actualizarDatos(
      idProyecto,
      idPlano,
      usuario.id_usuario,
      datos,
    );
  }
}