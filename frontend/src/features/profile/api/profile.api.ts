import {
  cuerpoJson,
  http,
} from '../../../shared/api/http';

import type {
  Usuario,
} from '../../auth/types/usuario';

export interface DatosActualizarPerfil {
  nombre?: string | null;
  apellidos?: string | null;
  telefono?: string | null;
  ubicacion?: string | null;
}

export function actualizarMiPerfil(
  datos: DatosActualizarPerfil,
): Promise<Usuario> {
  return http<Usuario>(
    '/api/usuarios/me/perfil',
    {
      method: 'PATCH',
      ...cuerpoJson(datos),
    },
  );
}