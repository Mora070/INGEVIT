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
 * 4. Coincidencia entre la versión del token y la cuenta.
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

    // Verifica firma, fechas, identidad y presencia de la versión.
    const identidad = await this.tokenService.verificarTokenConVersion(
      token,
    );

    // Compara con el estado actual de PostgreSQL en cada solicitud.
    const usuario = await this.usuariosService.obtenerPerfilDeSesion(
      identidad.id_usuario,
      identidad.version_sesion,
    );

    request.usuario = usuario;

    return true;
  }
}