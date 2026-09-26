export interface UsuarioColaboradorRow {
  id_usuario: string;
  nombre: string | null;
  apellidos: string | null;
  correo: string;
  foto_perfil_url: string | null;
}

export interface UsuarioColaboradorResponse {
  id_usuario: string;
  nombre: string | null;
  apellidos: string | null;
  correo: string;
  foto_perfil_url: string | null;
}