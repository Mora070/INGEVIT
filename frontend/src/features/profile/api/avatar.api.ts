import {
  http,
} from '../../../shared/api/http';

export interface AvatarResponse {
  foto_perfil_url: string | null;
}

export function subirAvatar(
  archivo: File,
): Promise<AvatarResponse> {
  const formulario =
    new FormData();

  formulario.append(
    'archivo',
    archivo,
  );

  return http<AvatarResponse>(
    '/api/usuarios/me/avatar',
    {
      method: 'POST',
      body: formulario,
    },
  );
}

export function eliminarAvatar(): Promise<AvatarResponse> {
  return http<AvatarResponse>(
    '/api/usuarios/me/avatar',
    {
      method: 'DELETE',
    },
  );
}

export function obtenerUrlAvatar(
  idUsuario: string,
): string {
  return `/api/usuarios/${encodeURIComponent(
    idUsuario,
  )}/avatar`;
}