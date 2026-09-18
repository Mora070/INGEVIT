import {
  cuerpoJson,
  http,
} from '../../../shared/api/http';

import type { Usuario } from '../types/usuario';

interface DatosGoogleLogin {
  credential: string;
}

export function iniciarSesionGoogle(
  credential: string,
): Promise<Usuario> {
  const datos: DatosGoogleLogin = {
    credential,
  };

  return http<Usuario>(
    '/api/auth/google',
    {
      method: 'POST',
      ...cuerpoJson(datos),
    },
  );
}