import {
  cuerpoJson,
  http,
} from '../../../shared/api/http';

import type {
  EstadoProyecto,
  Proyecto,
  ProyectosPaginados,
} from '../types/proyecto';

interface OpcionesListadoProyectos {
  pagina?: number;
  limite?: number;
}

export interface DatosCrearProyecto {
  nombre: string;
  descripcion: string;
  direccion: string;
  contratante: string;

  fecha_inicio: string;
  fecha_finalizacion?: string | null;

  estado_proyecto: EstadoProyecto;

  latitud?: number | null;
  longitud?: number | null;
}

export function listarProyectos(
  opciones: OpcionesListadoProyectos = {},
): Promise<ProyectosPaginados> {
  const pagina =
    opciones.pagina ?? 1;

  const limite =
    opciones.limite ?? 20;

  const parametros =
    new URLSearchParams({
      pagina: String(pagina),
      limite: String(limite),
    });

  return http<ProyectosPaginados>(
    `/api/proyectos?${parametros.toString()}`,
  );
}

export function obtenerProyecto(
  idProyecto: string,
): Promise<Proyecto> {
  return http<Proyecto>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}`,
  );
}

export function crearProyecto(
  datos: DatosCrearProyecto,
): Promise<Proyecto> {
  return http<Proyecto>(
    '/api/proyectos',
    {
      method: 'POST',
      ...cuerpoJson(datos),
    },
  );
}