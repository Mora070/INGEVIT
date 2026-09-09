import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthRequest } from '../types/auth-request.types';
import type { RolUsuario } from '../../usuarios/types/usuario.types';

/**
 * Comprueba los roles globales declarados mediante @Roles().
 *
 * Debe ejecutarse después de AuthGuard:
 * la identidad y el rol deben proceder de PostgreSQL.
 *
 * No consulta roles enviados en el cuerpo, encabezados o JWT.
 * No comprueba propiedad ni colaboración en proyectos.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    /**
     * La declaración del método tiene prioridad sobre la del controlador.
     * Así una ruta puede definir explícitamente sus propios roles.
     */
    const rolesPermitidos =
      this.reflector.getAllAndOverride<readonly RolUsuario[]>(
        ROLES_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    /**
     * Si no hay una restricción declarada, este guard no añade ninguna.
     * Eso no sustituye la autenticación de la ruta.
     */
    if (rolesPermitidos === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const usuario = request.usuario;

    if (usuario === undefined) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    if (!rolesPermitidos.includes(usuario.rol)) {
      throw new ForbiddenException(
        'No tienes permisos para realizar esta operación.',
      );
    }

    return true;
  }
}