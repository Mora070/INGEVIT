import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

import type {
  ActividadPaginaConsultaRow,
  ResultadoConsultaActividades,
} from './types/actividades-paginadas-row.types';

import type { ActividadRow } from './types/actividad.types';

/**
 * Consulta el historial sin modificar sus registros.
 *
 * Comprueba el acceso dentro de la misma sentencia que obtiene
 * las actividades y su total.
 */
@Injectable()
export class ActividadesConsultaRepository {
  constructor(
    private readonly database: DatabaseService,
  ) {}

  /**
   * Obtiene una página del historial disponible para el solicitante.
   *
   * Precondición: pagina y limite ya fueron validados por el DTO.
   *
   * @returns null si el proyecto no está disponible; en otro caso,
   * devuelve la página solicitada y el total de actividades.
   */
  async findDisponiblesPaginadas(
    idProyecto: string,
    idUsuario: string,
    pagina: number,
    limite: number,
  ): Promise<ResultadoConsultaActividades> {
    const desplazamiento = (pagina - 1) * limite;

    const resultado =
      await this.database.query<ActividadPaginaConsultaRow>(
        `
          WITH proyecto_disponible AS (
            SELECT p.id_proyecto
            FROM obra.proyectos AS p
            INNER JOIN obra.usuarios AS propietario
              ON propietario.id_usuario = p.id_propietario
            INNER JOIN obra.usuarios AS solicitante
              ON solicitante.id_usuario = $2::uuid
            WHERE p.id_proyecto = $1::uuid
              AND p.activo = true
              AND propietario.estado = 'ACTIVO'
              AND solicitante.estado = 'ACTIVO'
              AND (
                p.id_propietario = solicitante.id_usuario
                OR EXISTS (
                  SELECT 1
                  FROM obra.usuario_proyecto AS relacion
                  WHERE relacion.id_proyecto = p.id_proyecto
                    AND relacion.id_usuario = solicitante.id_usuario
                )
              )
          ),
          conteo AS (
            SELECT (
              SELECT COUNT(*)::text
              FROM obra.actividades AS actividad
              WHERE actividad.id_proyecto = proyecto.id_proyecto
            ) AS total
            FROM proyecto_disponible AS proyecto
          ),
          pagina_seleccionada AS (
            SELECT
              actividad.id_actividad,
              actividad.id_proyecto,
              actividad.id_actor,
              actividad.tipo_accion,
              actividad.mensaje,
              actividad.fecha_creacion
            FROM obra.actividades AS actividad
            INNER JOIN proyecto_disponible AS proyecto
              ON proyecto.id_proyecto = actividad.id_proyecto
            ORDER BY
              actividad.fecha_creacion DESC,
              actividad.id_actividad DESC
            LIMIT $3::integer
            OFFSET $4::bigint
          )
          SELECT
            pagina.id_actividad,
            pagina.id_proyecto,
            pagina.id_actor,
            pagina.tipo_accion,
            pagina.mensaje,
            pagina.fecha_creacion,
            conteo.total
          FROM conteo
          LEFT JOIN pagina_seleccionada AS pagina ON true
          ORDER BY
            pagina.fecha_creacion DESC,
            pagina.id_actividad DESC
        `,
        [idProyecto, idUsuario, limite, desplazamiento],
      );

    const primeraFila = resultado.rows[0];

    // Sin proyecto disponible, el CTE conteo tampoco devuelve filas.
    if (!primeraFila) {
      return null;
    }

    const totalTexto = primeraFila.total;

    if (
      typeof totalTexto !== 'string'
      || !/^\d+$/.test(totalTexto)
    ) {
      throw new Error(
        'El conteo de actividades tiene un formato inesperado.',
      );
    }

    const total = Number(totalTexto);

    if (!Number.isSafeInteger(total) || total < 0) {
      throw new Error(
        'El total de actividades no puede representarse correctamente.',
      );
    }

    const actividades: ActividadRow[] = [];

    for (const fila of resultado.rows) {
      // El LEFT JOIN conserva el total cuando la página está vacía.
      if (fila.id_actividad === null) {
        continue;
      }

      // El conteo es un metadato de la página, no de cada actividad.
      actividades.push({
        id_actividad: fila.id_actividad,
        id_proyecto: fila.id_proyecto,
        id_actor: fila.id_actor,
        tipo_accion: fila.tipo_accion,
        mensaje: fila.mensaje,
        fecha_creacion: fila.fecha_creacion,
      });
    }

    return {
      actividades,
      total,
    };
  }
}