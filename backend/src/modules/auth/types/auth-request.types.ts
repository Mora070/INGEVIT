import type { Request } from 'express';
import type { UsuarioResponse } from '../../usuarios/types/usuario.types';

/**
 * Solicitud HTTP que puede recibir una identidad autenticada.
 *
 * La propiedad es opcional porque todavía no existe
 * antes de que el guard complete sus comprobaciones.
 *
 * Solo el backend debe asignarla. No procede del cuerpo,
 * de los parámetros ni de encabezados de identidad del cliente.
 */
export interface AuthRequest extends Request {
  usuario?: UsuarioResponse;
}