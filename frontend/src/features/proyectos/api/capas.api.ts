import {
  http,
} from '../../../shared/api/http';

import type {
  CapaProyecto,
  CapasPaginadas,
  DatosActualizarConfiguracionCapa,
  DatosSubirCapa,
  TileJsonCapa,
} from '../types/capa';

interface OpcionesListarCapas {
  pagina?: number;

  limite?: number;
}

/**
 * Lista las capas disponibles
 * para el proyecto autenticado.
 */
export function listarCapasProyecto(
  idProyecto: string,
  opciones: OpcionesListarCapas = {},
): Promise<CapasPaginadas> {
  const pagina =
    opciones.pagina ?? 1;

  const limite =
    opciones.limite ?? 50;

  const parametros =
    new URLSearchParams({
      pagina:
        String(pagina),

      limite:
        String(limite),
    });

  return http<CapasPaginadas>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/capas?${parametros.toString()}`,
  );
}

/**
 * Sube una nueva capa GeoTIFF.
 *
 * El backend recibe multipart/form-data:
 * - nombre
 * - descripcion
 * - archivo
 */
export function subirCapaProyecto(
  idProyecto: string,
  datos: DatosSubirCapa,
): Promise<CapaProyecto> {
  const formulario =
    new FormData();

  formulario.append(
    'nombre',
    datos.nombre,
  );

  formulario.append(
    'descripcion',
    datos.descripcion,
  );

  formulario.append(
    'archivo',
    datos.archivo,
  );

  return http<CapaProyecto>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/capas`,
    {
      method:
        'POST',

      body:
        formulario,
    },
  );
}

/**
 * Actualiza la configuración compartida
 * de una capa.
 *
 * El backend exige siempre:
 * - opacidad
 * - visible
 * - orden
 */
export function actualizarConfiguracionCapa(
  idProyecto: string,
  idCapa: string,
  datos:
    DatosActualizarConfiguracionCapa,
): Promise<CapaProyecto> {
  return http<CapaProyecto>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/capas/${encodeURIComponent(
      idCapa,
    )}/configuracion`,
    {
      method:
        'PATCH',

      headers: {
        'Content-Type':
          'application/json',
      },

      body:
        JSON.stringify({
          opacidad:
            datos.opacidad,

          visible:
            datos.visible,

          orden:
            datos.orden,
        }),
    },
  );
}

/**
 * Devuelve el TileJSON
 * de una versión publicada.
 *
 * No tipamos todavía el contenido
 * hasta revisar el servicio de TileJSON,
 * porque ahí se define exactamente
 * qué campos devuelve el backend.
 */
export function obtenerTileJsonCapa(
  idProyecto: string,
  idCapa: string,
  version: string,
): Promise<TileJsonCapa> {
  return http<TileJsonCapa>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/capas/${encodeURIComponent(
      idCapa,
    )}/teselas/${encodeURIComponent(
      version,
    )}/tilejson.json`,
  );
}

export async function eliminarCapaProyecto(
  idProyecto: string,
  idCapa: string,
): Promise<void> {
  await http<void>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/capas/${encodeURIComponent(
      idCapa,
    )}`,
    {
      method: 'DELETE',
    },
  );
}

export interface ResultadoReintentoCapa {
  id_capa: string;

  estado_procesamiento:
    'PENDIENTE';
}

export async function reintentarCapaProyecto(
  idProyecto: string,
  idCapa: string,
): Promise<ResultadoReintentoCapa> {
  return http<ResultadoReintentoCapa>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/capas/${encodeURIComponent(
      idCapa,
    )}/reintentar`,
    {
      method: 'POST',
    },
  );
}