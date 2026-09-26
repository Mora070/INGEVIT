import {
  Controller,
  Get,
  Header,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
} from '../auth/guards/auth.guard';

import type {
  AuthRequest,
} from '../auth/types/auth-request.types';

import {
  UsuariosService,
  type UsuariosColaboradoresPaginadosResponse,
} from './usuarios.service';

import {
  ListarUsuariosColaboradoresQueryDto,
} from './dto/listar-usuarios-colaboradores-query.dto';

/**
 * Expone operaciones generales de usuarios
 * que requieren una sesión autenticada.
 *
 * Este controlador no devuelve información
 * interna de autenticación.
 */
@Controller('usuarios')
@UseGuards(AuthGuard)
export class UsuariosController {
  constructor(
    private readonly usuariosService:
      UsuariosService,
  ) {}

  /**
   * Lista cuentas activas disponibles para
   * seleccionar como colaboradores.
   *
   * La identidad autenticada se excluye
   * automáticamente de los resultados.
   *
   * Permite búsqueda progresiva por correo.
   *
   * Ejemplo:
   * GET /usuarios/disponibles?correo=fel&pagina=1&limite=20
   */
  @Get('disponibles')
  @Header(
    'Cache-Control',
    'no-store',
  )
  async listarDisponibles(
    @Req()
    request: AuthRequest,

    @Query()
    consulta:
      ListarUsuariosColaboradoresQueryDto,
  ): Promise<UsuariosColaboradoresPaginadosResponse> {
    const usuario =
      request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.usuariosService
      .listarDisponiblesParaColaborador(
        usuario.id_usuario,
        consulta,
      );
  }
}