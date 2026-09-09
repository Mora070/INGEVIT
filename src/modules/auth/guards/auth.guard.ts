import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { UsuariosService } from '../../usuarios/usuarios.service';
import { AUTH_COOKIE_NAME } from '../auth-cookie.config';
import { TokenService } from '../services/token.service';
import type { AuthRequest } from '../types/auth-request.types';

/**
 * Protege una ruta mediante la cookie de acceso.
 *
 * Comprueba:
 * 1. Existencia de una cookie con valor de texto.
 * 2. Firma, vencimiento y contenido del JWT.
 * 3. Existencia y estado actual del usuario en PostgreSQL.
 *
 * No comprueba permisos específicos sobre proyectos.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly usuariosService: UsuariosService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();

    // La identidad se asignará únicamente tras completar la autenticación.
    delete request.usuario;

    /**
     * Los datos recibidos del cliente se tratan como desconocidos,
     * aunque los tipos de Express sean más permisivos.
     */
    const cookies: unknown = request.cookies;

    if (
      typeof cookies !== 'object' ||
      cookies === null ||
      Array.isArray(cookies)
    ) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    const token: unknown =
      (cookies as Record<string, unknown>)[AUTH_COOKIE_NAME];

    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    // No consultamos PostgreSQL hasta haber verificado el token.
    const idUsuario = await this.tokenService.verificarToken(token);

    /**
     * Este método consulta el estado actual y rechaza cuentas
     * inexistentes o inactivas. También devuelve un perfil sin secretos.
     *
     * No reutilizamos el estado de una solicitud anterior.
     */
    const usuario =
      await this.usuariosService.obtenerMiPerfil(idUsuario);

    request.usuario = usuario;

    return true;
  }
}