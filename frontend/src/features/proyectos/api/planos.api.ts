import {
  http,
} from '../../../shared/api/http';

import type {
  PlanoProyecto,
  PlanosPaginados,
} from '../types/plano';

interface OpcionesListadoPlanos {
  pagina?: number;
  limite?: number;
}

interface DatosSubirPlano {
  titulo: string;
  descripcion: string;
  archivo: File;
}

interface DatosActualizarPlano {
  titulo: string;
  descripcion: string;
}

/**
 * Obtiene los planos PDF asociados
 * a un proyecto.
 */
export function listarPlanosProyecto(
  idProyecto: string,
  opciones:
    OpcionesListadoPlanos = {},
): Promise<PlanosPaginados> {
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

  return http<PlanosPaginados>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/planos?${parametros.toString()}`,
  );
}

/**
 * Sube un nuevo plano PDF.
 *
 * El backend recibe:
 * - titulo
 * - descripcion
 * - archivo
 *
 * mediante multipart/form-data.
 */
export function subirPlanoProyecto(
  idProyecto: string,
  datos:
    DatosSubirPlano,
): Promise<PlanoProyecto> {
  const formulario =
    new FormData();

  formulario.append(
    'titulo',
    datos.titulo,
  );

  formulario.append(
    'descripcion',
    datos.descripcion,
  );

  formulario.append(
    'archivo',
    datos.archivo,
  );

  return http<PlanoProyecto>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/planos`,
    {
      method:
        'POST',

      body:
        formulario,
    },
  );
}

/**
 * Modifica únicamente los datos
 * descriptivos de un plano.
 *
 * El backend exige enviar siempre:
 * - titulo
 * - descripcion
 */
export function actualizarPlanoProyecto(
  idProyecto: string,
  idPlano: string,
  datos:
    DatosActualizarPlano,
): Promise<PlanoProyecto> {
  return http<PlanoProyecto>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/planos/${encodeURIComponent(
      idPlano,
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
        }),
    },
  );
}

/**
 * Elimina el plano del proyecto.
 *
 * El backend responde con 204 No Content.
 * La eliminación física del archivo PDF
 * puede completarse posteriormente en
 * segundo plano.
 */
export function eliminarPlanoProyecto(
  idProyecto: string,
  idPlano: string,
): Promise<void> {
  return http<void>(
    `/api/proyectos/${encodeURIComponent(
      idProyecto,
    )}/planos/${encodeURIComponent(
      idPlano,
    )}`,
    {
      method:
        'DELETE',
    },
  );
}