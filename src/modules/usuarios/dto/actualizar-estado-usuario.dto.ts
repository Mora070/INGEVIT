import { IsIn, IsString } from 'class-validator';

import type { EstadoUsuario } from '../types/usuario.types';

/**
 * Estados admitidos por esta operación.
 *
 * EstadoUsuario comprueba los valores durante la compilación.
 * IsIn los comprueba cuando llega una solicitud HTTP.
 */
const ESTADOS_PERMITIDOS: EstadoUsuario[] = [
  'ACTIVO',
  'INACTIVO',
];

/**
 * Entrada para activar o inactivar una cuenta.
 *
 * No permite modificar el rol, el correo ni otros datos del usuario.
 * ValidationPipe rechazará cualquier propiedad adicional.
 *
 * La autorización del administrador se comprobará mediante
 * AuthGuard y RolesGuard en la ruta.
 */
export class ActualizarEstadoUsuarioDto {
  @IsString({
    message: 'El estado debe ser un texto.',
  })
  @IsIn(ESTADOS_PERMITIDOS, {
    message: 'El estado debe ser ACTIVO o INACTIVO.',
  })
  estado!: EstadoUsuario;
}