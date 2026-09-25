import type {
  ProyectoListadoResponse,
  ProyectoListadoRow,
} from '../types/proyecto-listado.types';

import { toProyectoResponse } from './proyecto.mapper';

/**
 * Convierte la fila enriquecida del listado en su representación HTTP.
 *
 * Reutiliza el mapper normal del proyecto para conservar exactamente
 * las mismas reglas existentes sobre coordenadas, fechas y campos base.
 *
 * Después añade:
 * - equipo
 * - ultima_actualizacion
 */
export function toProyectoListadoResponse(
  proyecto: ProyectoListadoRow,
): ProyectoListadoResponse {
  const proyectoBase =
    toProyectoResponse(proyecto);

  return {
    ...proyectoBase,

    equipo: proyecto.equipo.map(
      (participante) => ({
        id_usuario:
          participante.id_usuario,

        nombre:
          participante.nombre,

        apellidos:
          participante.apellidos,

        foto_perfil_url:
          participante.foto_perfil_url,

        participacion:
          participante.participacion,
      }),
    ),

    ultima_actualizacion:
      proyecto.ultima_actualizacion
        ? proyecto.ultima_actualizacion.toISOString()
        : null,
  };
}