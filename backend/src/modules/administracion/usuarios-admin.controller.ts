import {
  Body,
  Controller,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ActualizarEstadoUsuarioDto } from '../usuarios/dto/actualizar-estado-usuario.dto';
import type { UsuarioResponse } from '../usuarios/types/usuario.types';

/**
 * Operaciones administrativas sobre cuentas.
 *
 * AuthGuard obtiene la identidad y el estado actual desde PostgreSQL.
 * RolesGuard comprueba después el rol ADMINISTRADOR.
 *
 * OriginGuard sigue aplicándose globalmente desde AppModule.
 */
@Controller('admin/usuarios')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class UsuariosAdminController {
  constructor(
    private readonly usuariosService: UsuariosService,
  ) {}

  /**
   * Activa o inactiva la cuenta identificada en la ruta.
   *
   * idUsuario identifica la cuenta que se modificará;
   * no identifica a quien realiza la solicitud.
   *
   * ParseUUIDPipe rechaza identificadores malformados.
   * ValidationPipe comprueba el cuerpo mediante el DTO.
   */
  @Patch(':idUsuario/estado')
  @Header('Cache-Control', 'no-store')
  async actualizarEstado(
    @Param('idUsuario', new ParseUUIDPipe())
    idUsuario: string,
    @Body() dto: ActualizarEstadoUsuarioDto,
  ): Promise<UsuarioResponse> {
    return this.usuariosService.actualizarEstado(
      idUsuario,
      dto.estado,
    );
  }
}