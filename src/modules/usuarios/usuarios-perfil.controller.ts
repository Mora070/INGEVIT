import {
  Body,
  Controller,
  Header,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';

import { UsuariosService } from './usuarios.service';
import { ActualizarMiPerfilDto } from './dto/actualizar-mi-perfil.dto';
import type { UsuarioResponse } from './types/usuario.types';

/**
 * Expone operaciones sobre el perfil de la sesión actual.
 *
 * AuthGuard valida la sesión.
 * El OriginGuard global protege la solicitud de modificación.
 * El ValidationPipe global valida el DTO y rechaza campos adicionales.
 */
@Controller('usuarios/me')
@UseGuards(AuthGuard)
export class UsuariosPerfilController {
  constructor(
    private readonly usuariosService: UsuariosService,
  ) {}

  /**
   * Actualiza exclusivamente el perfil del usuario autenticado.
   * La identidad nunca procede del cuerpo de la solicitud.
   */
  @Patch('perfil')
  @Header('Cache-Control', 'no-store')
  async actualizarMiPerfil(
    @Req() request: AuthRequest,
    @Body() datos: ActualizarMiPerfilDto,
  ): Promise<UsuarioResponse> {
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.usuariosService.actualizarMiPerfil(
      usuario.id_usuario,
      datos,
    );
  }
}