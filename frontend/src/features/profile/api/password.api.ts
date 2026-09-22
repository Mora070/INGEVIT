import {
  cuerpoJson,
  http,
} from '../../../shared/api/http';

export interface DatosCambiarPassword {
  password_actual: string;
  password_nueva: string;
}

export async function cambiarPassword(
  datos: DatosCambiarPassword,
): Promise<void> {
  await http<void>(
    '/api/auth/cambiar-password',
    {
      method: 'POST',
      ...cuerpoJson(datos),
    },
  );
}