import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import type { IncidenciaMapaRow } from './incidencias.repository';

type FilaConsulta = (
  | IncidenciaMapaRow
  | { [K in keyof IncidenciaMapaRow]: null }
) & { total: string };

export interface IncidenciasMapaConsultadas {
  incidencias: IncidenciaMapaRow[];
  total: number;
}

/**
 * Consulta incidencias creadas directamente en el mapa.
 *
 * Comprueba acceso y obtiene resultados en una misma sentencia.
 * No concede acceso adicional por el rol global del usuario.
 *
 * Devuelve null cuando el proyecto no está disponible.
 * Una página vacía de un proyecto accesible conserva su total.
 */
@Injectable()
export class IncidenciasMapaConsultaRepository {
  constructor(
    private readonly database: DatabaseService,
  ) {}

  /**
   * pagina y limite deben haber sido validados por el DTO.
   * El orden por fecha e identificador resuelve empates entre registros.
   */
  async listarDisponibles(
    idProyecto: string,
    idUsuario: string,
    pagina: number,
    limite: number,
  ): Promise<IncidenciasMapaConsultadas | null> {
    const resultado = await this.database.query<FilaConsulta>(
      `
        WITH disponible AS (
          SELECT proyecto.id_proyecto
          FROM obra.proyectos AS proyecto
          JOIN obra.usuarios AS propietario
            ON propietario.id_usuario = proyecto.id_propietario
          JOIN obra.usuarios AS solicitante
            ON solicitante.id_usuario = $2::uuid
          WHERE proyecto.id_proyecto = $1::uuid
            AND proyecto.activo = TRUE
            AND propietario.estado = 'ACTIVO'
            AND solicitante.estado = 'ACTIVO'
            AND (
              proyecto.id_propietario = solicitante.id_usuario
              OR EXISTS (
                SELECT 1
                FROM obra.usuario_proyecto AS colaboracion
                WHERE colaboracion.id_proyecto = proyecto.id_proyecto
                  AND colaboracion.id_usuario = solicitante.id_usuario
              )
            )
        ),
        filtradas AS (
          SELECT incidencia.*
          FROM obra.incidencias AS incidencia
          JOIN disponible
            ON disponible.id_proyecto = incidencia.id_proyecto
          WHERE incidencia.id_plano IS NULL
        ),
        conteo AS (
          SELECT COUNT(*)::text AS total
          FROM filtradas
        ),
        seleccion AS (
          SELECT *
          FROM filtradas
          ORDER BY fecha_creacion DESC, id_incidencia DESC
          LIMIT $3::integer
          OFFSET $4::bigint
        )
        SELECT
          seleccion.id_incidencia,
          seleccion.id_proyecto,
          seleccion.id_plano,
          seleccion.id_creador,
          seleccion.titulo,
          seleccion.descripcion,
          seleccion.estado,
          seleccion.prioridad,
          seleccion.numero_pagina,
          seleccion.coordenada_x,
          seleccion.coordenada_y,
          seleccion.latitud,
          seleccion.longitud,
          seleccion.fecha_creacion,
          conteo.total
        FROM disponible
        CROSS JOIN conteo
        LEFT JOIN seleccion ON TRUE
        ORDER BY seleccion.fecha_creacion DESC, seleccion.id_incidencia DESC
      `,
      [idProyecto, idUsuario, limite, (pagina - 1) * limite],
    );

    const primera = resultado.rows[0];

    if (!primera) {
      return null;
    }

    const total = Number(primera.total);

    if (
      typeof primera.total !== 'string'
      || !/^\d+$/.test(primera.total)
      || primera.total.includes('\n')
      || primera.total.includes('\r')
      || !Number.isSafeInteger(total)
      || total < 0
    ) {
      throw new Error(
        'El conteo de incidencias de mapa tiene un formato inesperado.',
      );
    }

    const incidencias: IncidenciaMapaRow[] = [];

    for (const fila of resultado.rows) {
      // El LEFT JOIN conserva el total cuando la página está vacía.
      if (fila.id_incidencia === null) {
        continue;
      }

      incidencias.push({
        id_incidencia: fila.id_incidencia,
        id_proyecto: fila.id_proyecto,
        id_plano: fila.id_plano,
        id_creador: fila.id_creador,
        titulo: fila.titulo,
        descripcion: fila.descripcion,
        estado: fila.estado,
        prioridad: fila.prioridad,
        numero_pagina: fila.numero_pagina,
        coordenada_x: fila.coordenada_x,
        coordenada_y: fila.coordenada_y,
        latitud: fila.latitud,
        longitud: fila.longitud,
        fecha_creacion: fila.fecha_creacion,
      });
    }

    return { incidencias, total };
  }
}