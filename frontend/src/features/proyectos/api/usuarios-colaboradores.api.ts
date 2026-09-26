import {
  http,
} from '../../../shared/api/http';

import type {
  UsuariosDisponiblesPaginados,
} from '../types/usuario-colaborador';

interface OpcionesUsuariosDisponibles {
  correo?: string;
  pagina?: number;
  limite?: number;
}

export function listarUsuariosDisponibles(
  opciones:
    OpcionesUsuariosDisponibles = {},
): Promise<UsuariosDisponiblesPaginados> {
  const pagina =
    opciones.pagina ?? 1;

  const limite =
    opciones.limite ?? 20;

  const parametros =
    new URLSearchParams({
      pagina: String(pagina),
      limite: String(limite),
    });

  const correo =
    opciones.correo?.trim();

  if (correo) {
    parametros.set(
      'correo',
      correo,
    );
  }

  return http<UsuariosDisponiblesPaginados>(
    `/api/usuarios/disponibles?${parametros.toString()}`,
  );
}