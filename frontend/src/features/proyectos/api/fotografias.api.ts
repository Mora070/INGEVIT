import {
  http,
} from '../../../shared/api/http';

import type {
  FotografiaProyecto,
  FotografiasPaginadas,
} from '../types/fotografia';

interface OpcionesListadoFotografias {
  pagina?: number;
  limite?: number;
}

interface DatosSubirFotografia {
  titulo: string;

  archivo: File;
}

/**
 * Obtiene una página de fotografías del proyecto.
 */
export function listarFotografiasProyecto(
  idProyecto: string,
  opciones:
    OpcionesListadoFotografias = {},
): Promise<FotografiasPaginadas> {
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

  return http<FotografiasPaginadas>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/fotografias?${parametros.toString()}`,
  );
}

/**
 * Sube una fotografía al proyecto.
 *
 * El backend recibe multipart/form-data:
 * - titulo
 * - archivo
 *
 * La fotografía se almacena sin ubicación.
 * La ubicación pertenece a la incidencia
 * creada posteriormente sobre el mapa.
 */
export function subirFotografiaProyecto(
  idProyecto: string,
  datos:
    DatosSubirFotografia,
): Promise<FotografiaProyecto> {
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

  return http<FotografiaProyecto>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/fotografias`,
    {
      method:
        'POST',

      body:
        formulario,
    },
  );
}

/**
 * Selecciona una fotografía existente
 * como portada del proyecto.
 */
export function establecerPortadaProyecto(
  idProyecto: string,
  idFotografia: string,
): Promise<FotografiaProyecto> {
  return http<FotografiaProyecto>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/fotografias/${encodeURIComponent(
      idFotografia,
    )}/portada`,
    {
      method:
        'PATCH',
    },
  );
}

/**
 * Elimina una fotografía del proyecto.
 *
 * El backend responde 204 cuando
 * la eliminación se completa.
 */
export function eliminarFotografiaProyecto(
  idProyecto: string,
  idFotografia: string,
): Promise<void> {
  return http<void>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/fotografias/${encodeURIComponent(
      idFotografia,
    )}`,
    {
      method:
        'DELETE',
    },
  );
}