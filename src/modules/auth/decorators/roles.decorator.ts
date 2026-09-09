import { SetMetadata } from '@nestjs/common';
import type { RolUsuario } from '../../usuarios/types/usuario.types';

/**
 * Identifica los metadatos que leerá RolesGuard.
 */
export const ROLES_KEY = 'auth:roles';

/**
 * Declara los roles globales permitidos en un controlador o método.
 *
 * Ejemplo:
 * @Roles('ADMINISTRADOR')
 *
 * Este decorador solo declara información.
 * RolesGuard es quien comprueba y aplica la restricción.
 *
 * Exigimos al menos un rol para evitar una declaración vacía.
 */
export const Roles = (
  ...roles: [RolUsuario, ...RolUsuario[]]
) => SetMetadata(ROLES_KEY, roles);