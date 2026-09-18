import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Identifica la configuración que Nest inyectará en el guard.
 * Symbol evita colisiones con otros proveedores.
 */
export const AUTH_ALLOWED_ORIGINS = Symbol('AUTH_ALLOWED_ORIGINS');

/**
 * Métodos que no deben ejecutar cambios de negocio.
 * OPTIONS también se utiliza en las consultas previas de CORS.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Comprueba el origen de las solicitudes que pueden modificar datos.
 *
 * Complementa la cookie SameSite.
 * No autentica usuarios ni comprueba permisos sobre proyectos.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(
    @Inject(AUTH_ALLOWED_ORIGINS)
    private readonly allowedOrigins: ReadonlySet<string>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const origin = request.headers.origin;

    /**
     * Exigimos una coincidencia exacta.
     * No normalizamos el encabezado ni aceptamos coincidencias parciales.
     *
     * También se rechazan:
     * - La ausencia del encabezado.
     * - El valor literal "null".
     * - Valores múltiples o de un tipo inesperado.
     */
    if (
      typeof origin !== 'string' ||
      !this.allowedOrigins.has(origin)
    ) {
      throw new ForbiddenException(
        'El origen de la solicitud no está permitido.',
      );
    }

    return true;
  }
}