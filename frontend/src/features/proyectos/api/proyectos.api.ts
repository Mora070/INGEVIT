import {
  cuerpoJson,
  http,
} from '../../../shared/api/http';

import type {
  EstadoProyecto,
  ParticipanteProyecto,
  Proyecto,
  ProyectosPaginados,
} from '../types/proyecto';

interface OpcionesListadoProyectos {
  pagina?: number;
  limite?: number;
  busqueda?: string;
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

interface DatosAgregarColaborador {
  id_usuario: string;
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

  const busqueda =
    opciones.busqueda?.trim();

  if (busqueda) {
    parametros.set(
      'busqueda',
      busqueda,
    );
  }

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

export function listarParticipantesProyecto(
  idProyecto: string,
): Promise<ParticipanteProyecto[]> {
  return http<ParticipanteProyecto[]>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/participantes`,
  );
}

export async function agregarColaboradorProyecto(
  idProyecto: string,
  idUsuario: string,
): Promise<void> {
  const datos:
    DatosAgregarColaborador = {
      id_usuario:
        idUsuario,
    };

  await http<void>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/colaboradores`,
    {
      method: 'POST',
      ...cuerpoJson(datos),
    },
  );
}

export async function retirarColaboradorProyecto(
  idProyecto: string,
  idUsuario: string,
): Promise<void> {
  await http<void>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/colaboradores/${encodeURIComponent(
      idUsuario,
    )}`,
    {
      method: 'DELETE',
    },
  );
}