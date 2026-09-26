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

  latitud: number;
  longitud: number;
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
      pagina: String(pagina),
      limite: String(limite),
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
 * - latitud
 * - longitud
 *
 * No se establece Content-Type manualmente.
 * El navegador genera el boundary.
 */
export function subirFotografiaProyecto(
  idProyecto: string,
  datos: DatosSubirFotografia,
): Promise<FotografiaProyecto> {
  const formulario =
    new FormData();

  formulario.append(
    'titulo',
    datos.titulo,
  );

  formulario.append(
    'latitud',
    String(datos.latitud),
  );

  formulario.append(
    'longitud',
    String(datos.longitud),
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
      method: 'POST',
      body: formulario,
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
      method: 'PATCH',
    },
  );
}