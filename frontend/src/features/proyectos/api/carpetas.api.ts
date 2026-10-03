import {
  cuerpoJson,
  http,
} from '../../../shared/api/http';

import type {
  CarpetaProyecto,
  ContenidoCarpeta,
  TipoRecursoCarpeta,
} from '../types/carpeta';

export interface DatosCrearCarpeta {
  nombre: string;

  id_carpeta_padre?: string | null;
}

export interface DatosActualizarCarpeta {
  nombre: string;
}

export interface DatosMoverCarpeta {
  id_carpeta_padre?: string | null;
}

export interface DatosAgregarRecursoCarpeta {
  tipo: TipoRecursoCarpeta;

  id_recurso: string;
}

/**
 * Lista las carpetas de un proyecto.
 *
 * Si no se proporciona idCarpetaPadre,
 * devuelve las carpetas de la raíz.
 *
 * Si se proporciona, devuelve las
 * subcarpetas de esa carpeta.
 */
export function listarCarpetasProyecto(
  idProyecto: string,
  idCarpetaPadre?: string | null,
): Promise<CarpetaProyecto[]> {
  const rutaBase =
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/carpetas`;

  if (!idCarpetaPadre) {
    return http<CarpetaProyecto[]>(
      rutaBase,
    );
  }

  const parametros =
    new URLSearchParams({
      id_carpeta_padre:
        idCarpetaPadre,
    });

  return http<CarpetaProyecto[]>(
    `${rutaBase}?${parametros.toString()}`,
  );
}

/**
 * Obtiene una carpeta junto con
 * sus subcarpetas y recursos.
 */
export function obtenerContenidoCarpeta(
  idProyecto: string,
  idCarpeta: string,
): Promise<ContenidoCarpeta> {
  return http<ContenidoCarpeta>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/carpetas/${encodeURIComponent(
      idCarpeta,
    )}`,
  );
}

/**
 * Crea una carpeta en la raíz
 * o dentro de otra carpeta.
 */
export function crearCarpetaProyecto(
  idProyecto: string,
  datos: DatosCrearCarpeta,
): Promise<CarpetaProyecto> {
  return http<CarpetaProyecto>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/carpetas`,
    {
      method:
        'POST',

      ...cuerpoJson(
        datos,
      ),
    },
  );
}

/**
 * Actualiza el nombre de una carpeta.
 */
export function actualizarCarpetaProyecto(
  idProyecto: string,
  idCarpeta: string,
  datos: DatosActualizarCarpeta,
): Promise<CarpetaProyecto> {
  return http<CarpetaProyecto>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/carpetas/${encodeURIComponent(
      idCarpeta,
    )}`,
    {
      method:
        'PATCH',

      ...cuerpoJson(
        datos,
      ),
    },
  );
}

/**
 * Mueve una carpeta.
 *
 * id_carpeta_padre null permite
 * moverla nuevamente a la raíz.
 */
export function moverCarpetaProyecto(
  idProyecto: string,
  idCarpeta: string,
  datos: DatosMoverCarpeta,
): Promise<CarpetaProyecto> {
  return http<CarpetaProyecto>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/carpetas/${encodeURIComponent(
      idCarpeta,
    )}/mover`,
    {
      method:
        'PATCH',

      ...cuerpoJson(
        datos,
      ),
    },
  );
}

/**
 * Elimina una carpeta.
 *
 * Los recursos originales del proyecto
 * no son eliminados por esta operación.
 */
export function eliminarCarpetaProyecto(
  idProyecto: string,
  idCarpeta: string,
): Promise<void> {
  return http<void>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/carpetas/${encodeURIComponent(
      idCarpeta,
    )}`,
    {
      method:
        'DELETE',
    },
  );
}

/**
 * Agrega un recurso existente
 * del proyecto a una carpeta.
 */
export function agregarRecursoCarpeta(
  idProyecto: string,
  idCarpeta: string,
  datos: DatosAgregarRecursoCarpeta,
): Promise<void> {
  return http<void>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/carpetas/${encodeURIComponent(
      idCarpeta,
    )}/recursos`,
    {
      method:
        'POST',

      ...cuerpoJson(
        datos,
      ),
    },
  );
}

/**
 * Quita un recurso de una carpeta.
 *
 * No elimina el recurso original
 * del proyecto.
 */
export function quitarRecursoCarpeta(
  idProyecto: string,
  idCarpeta: string,
  tipo: TipoRecursoCarpeta,
  idRecurso: string,
): Promise<void> {
  return http<void>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/carpetas/${encodeURIComponent(
      idCarpeta,
    )}/recursos/${encodeURIComponent(
      tipo,
    )}/${encodeURIComponent(
      idRecurso,
    )}`,
    {
      method:
        'DELETE',
    },
  );
}