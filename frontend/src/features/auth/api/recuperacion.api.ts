import {
  cuerpoJson,
  http,
} from '../../../shared/api/http';

export interface DatosSolicitudRecuperacion {
  correo: string;
}

export interface RespuestaSolicitudRecuperacion {
  message: string;
}

export interface DatosRestablecerPassword {
  correo: string;
  codigo: string;
  password_nueva: string;
}

export function solicitarRecuperacionPassword(
  datos: DatosSolicitudRecuperacion,
): Promise<RespuestaSolicitudRecuperacion> {
  return http<RespuestaSolicitudRecuperacion>(
    '/api/auth/recuperar-password',
    {
      method: 'POST',
      ...cuerpoJson(datos),
    },
  );
}

export async function restablecerPassword(
  datos: DatosRestablecerPassword,
): Promise<void> {
  await http<void>(
    '/api/auth/restablecer-password',
    {
      method: 'POST',
      ...cuerpoJson(datos),
    },
  );
}