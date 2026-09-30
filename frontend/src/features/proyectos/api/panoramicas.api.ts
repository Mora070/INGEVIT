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
 * - archivo
 *
 * La panorámica se almacena sin ubicación.
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

/**
 * Elimina una panorámica 360°
 * asociada al proyecto.
 *
 * El backend responde 204 cuando
 * la eliminación se completa.
 */
export function eliminarPanoramicaProyecto(
  idProyecto: string,
  idPanoramica: string,
): Promise<void> {
  return http<void>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/panoramicas/${encodeURIComponent(
      idPanoramica,
    )}`,
    {
      method:
        'DELETE',
    },
  );
}