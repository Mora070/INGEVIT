export interface UsuarioDisponibleColaborador {
  id_usuario: string;
  nombre: string | null;
  apellidos: string | null;
  correo: string;
  foto_perfil_url: string | null;
}

export interface UsuariosDisponiblesPaginados {
  usuarios: UsuarioDisponibleColaborador[];

  pagina: number;
  limite: number;

  total: number;
  total_paginas: number;
}