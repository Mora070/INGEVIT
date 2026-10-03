import {
  http,
} from '../../../shared/api/http';

import type {
  DatosCrearIncidenciaMapa,
  EstadoIncidencia,
  IncidenciaMapa,
  IncidenciaPlano,
  IncidenciasMapaPaginadas,
  IncidenciasPaginadas,
  PrioridadIncidencia,
} from '../types/incidencia';

interface OpcionesListadoIncidencias {
  numeroPagina: number;

  pagina?: number;

  limite?: number;
}

interface OpcionesListadoIncidenciasMapa {
  pagina?: number;

  limite?: number;
}

interface DatosCrearIncidencia {
  titulo: string;

  descripcion: string;

  prioridad: PrioridadIncidencia;

  numeroPagina: number;

  coordenadaX: number;

  coordenadaY: number;
}

/**
 * Datos descriptivos editables
 * compartidos por las incidencias.
 */
interface DatosActualizarIncidencia {
  titulo: string;

  descripcion: string;

  prioridad: PrioridadIncidencia;

  estado: EstadoIncidencia;
}

/**
 * Datos editables exclusivos
 * de una incidencia de mapa.
 *
 * Además de la ubicación,
 * permite modificar la fotografía
 * o panorámica asociada.
 *
 * Los campos multimedia son opcionales
 * para mantener compatibilidad con
 * ediciones que no los modifiquen.
 */
interface DatosActualizarIncidenciaMapa
  extends DatosActualizarIncidencia {
  latitud: number;

  longitud: number;

  id_fotografia?:
    string | null;

  id_panoramica?:
    string | null;
}

/**
 * Lista las incidencias asociadas
 * a una página concreta del PDF.
 */
export function listarIncidenciasPlano(
  idProyecto: string,
  idPlano: string,
  opciones:
    OpcionesListadoIncidencias,
): Promise<IncidenciasPaginadas> {
  const pagina =
    opciones.pagina ?? 1;

  const limite =
    opciones.limite ?? 50;

  const parametros =
    new URLSearchParams({
      numero_pagina:
        String(
          opciones.numeroPagina,
        ),

      pagina:
        String(pagina),

      limite:
        String(limite),
    });

  return http<IncidenciasPaginadas>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/planos/${encodeURIComponent(
      idPlano,
    )}/incidencias?${parametros.toString()}`,
  );
}

/**
 * Crea una incidencia sobre
 * una página concreta del plano.
 */
export function crearIncidenciaPlano(
  idProyecto: string,
  idPlano: string,
  datos:
    DatosCrearIncidencia,
): Promise<IncidenciaPlano> {
  return http<IncidenciaPlano>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/planos/${encodeURIComponent(
      idPlano,
    )}/incidencias`,
    {
      method:
        'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      body:
        JSON.stringify({
          titulo:
            datos.titulo,

          descripcion:
            datos.descripcion,

          prioridad:
            datos.prioridad,

          numero_pagina:
            datos.numeroPagina,

          coordenada_x:
            datos.coordenadaX,

          coordenada_y:
            datos.coordenadaY,
        }),
    },
  );
}

/**
 * Actualiza los cuatro campos
 * editables de una incidencia de plano.
 */
export function actualizarIncidenciaPlano(
  idProyecto: string,
  idPlano: string,
  idIncidencia: string,
  datos:
    DatosActualizarIncidencia,
): Promise<IncidenciaPlano> {
  return http<IncidenciaPlano>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/planos/${encodeURIComponent(
      idPlano,
    )}/incidencias/${encodeURIComponent(
      idIncidencia,
    )}`,
    {
      method:
        'PATCH',

      headers: {
        'Content-Type':
          'application/json',
      },

      body:
        JSON.stringify({
          titulo:
            datos.titulo,

          descripcion:
            datos.descripcion,

          prioridad:
            datos.prioridad,

          estado:
            datos.estado,
        }),
    },
  );
}

/**
 * Elimina una incidencia
 * asociada al plano.
 */
export function eliminarIncidenciaPlano(
  idProyecto: string,
  idPlano: string,
  idIncidencia: string,
): Promise<void> {
  return http<void>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/planos/${encodeURIComponent(
      idPlano,
    )}/incidencias/${encodeURIComponent(
      idIncidencia,
    )}`,
    {
      method:
        'DELETE',
    },
  );
}

/**
 * Lista las incidencias geográficas
 * creadas directamente sobre el mapa.
 */
export function listarIncidenciasMapa(
  idProyecto: string,
  opciones:
    OpcionesListadoIncidenciasMapa = {},
): Promise<IncidenciasMapaPaginadas> {
  const pagina =
    opciones.pagina ?? 1;

  const limite =
    opciones.limite ?? 100;

  const parametros =
    new URLSearchParams({
      pagina:
        String(pagina),

      limite:
        String(limite),
    });

  return http<IncidenciasMapaPaginadas>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/incidencias/mapa?${parametros.toString()}`,
  );
}

/**
 * Crea una incidencia directamente
 * sobre el mapa.
 *
 * Todas las incidencias de mapa tienen:
 * - latitud
 * - longitud
 *
 * Opcionalmente pueden relacionar:
 * - id_fotografia
 * - id_panoramica
 */
export function crearIncidenciaMapa(
  idProyecto: string,
  datos:
    DatosCrearIncidenciaMapa,
): Promise<IncidenciaMapa> {
  return http<IncidenciaMapa>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/incidencias/mapa`,
    {
      method:
        'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      body:
        JSON.stringify(
          datos,
        ),
    },
  );
}

/**
 * Actualiza una incidencia
 * creada directamente en el mapa.
 *
 * Permite modificar:
 * - título
 * - descripción
 * - prioridad
 * - estado
 * - latitud
 * - longitud
 * - fotografía relacionada
 * - panorámica relacionada
 *
 * Conserva:
 * - creador
 * - fecha de creación
 */
export function actualizarIncidenciaMapa(
  idProyecto: string,
  idIncidencia: string,
  datos:
    DatosActualizarIncidenciaMapa,
): Promise<IncidenciaMapa> {
  return http<IncidenciaMapa>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/incidencias/mapa/${encodeURIComponent(
      idIncidencia,
    )}`,
    {
      method:
        'PATCH',

      headers: {
        'Content-Type':
          'application/json',
      },

      body:
        JSON.stringify({
          titulo:
            datos.titulo,

          descripcion:
            datos.descripcion,

          prioridad:
            datos.prioridad,

          estado:
            datos.estado,

          latitud:
            datos.latitud,

          longitud:
            datos.longitud,

          id_fotografia:
            datos.id_fotografia,

          id_panoramica:
            datos.id_panoramica,
        }),
    },
  );
}

/**
 * Elimina una incidencia
 * creada directamente en el mapa.
 */
export function eliminarIncidenciaMapa(
  idProyecto: string,
  idIncidencia: string,
): Promise<void> {
  return http<void>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/incidencias/mapa/${encodeURIComponent(
      idIncidencia,
    )}`,
    {
      method:
        'DELETE',
    },
  );
}