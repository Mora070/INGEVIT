import {
  http,
} from '../../../shared/api/http';

import type {
  PanoramicaProyecto,
  PanoramicasPaginadas,
} from '../types/panoramica';

interface OpcionesListadoPanoramicas {
  pagina?: number;

  limite?: number;
}

interface DatosSubirPanoramica {
  titulo: string;

  archivo: File;

  latitud: number;

  longitud: number;
}

/**
 * Obtiene las imágenes panorámicas 360°
 * asociadas a un proyecto.
 */
export function listarPanoramicasProyecto(
  idProyecto: string,
  opciones:
    OpcionesListadoPanoramicas = {},
): Promise<PanoramicasPaginadas> {
  const pagina =
    opciones.pagina ?? 1;

  const limite =
    opciones.limite ?? 20;

  const parametros =
    new URLSearchParams({
      pagina:
        String(pagina),

      limite:
        String(limite),
    });

  return http<PanoramicasPaginadas>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/panoramicas?${parametros.toString()}`,
  );
}

/**
 * Sube una imagen panorámica 360°.
 *
 * El backend recibe multipart/form-data:
 * - titulo
 * - latitud
 * - longitud
 * - archivo
 *
 * No se define Content-Type manualmente.
 */
export function subirPanoramicaProyecto(
  idProyecto: string,
  datos:
    DatosSubirPanoramica,
): Promise<PanoramicaProyecto> {
  const formulario =
    new FormData();

  formulario.append(
    'titulo',
    datos.titulo,
  );

  formulario.append(
    'latitud',
    String(
      datos.latitud,
    ),
  );

  formulario.append(
    'longitud',
    String(
      datos.longitud,
    ),
  );

  formulario.append(
    'archivo',
    datos.archivo,
  );

  return http<PanoramicaProyecto>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/panoramicas`,
    {
      method:
        'POST',

      body:
        formulario,
    },
  );
}