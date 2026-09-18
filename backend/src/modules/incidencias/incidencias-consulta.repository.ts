import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import type { IncidenciaRow } from './incidencias.repository';

interface FilaConsulta {
  numero_paginas: number;
  total: string;

  // El LEFT JOIN devuelve null cuando no hay resultados en esa página.
  id_incidencia: string | null;
  id_proyecto: string | null;
  id_plano: string | null;
  id_creador: string | null;
  titulo: string | null;
  descripcion: string | null;
  estado: IncidenciaRow['estado'] | null;
  prioridad: IncidenciaRow['prioridad'] | null;
  numero_pagina: number | null;
  coordenada_x: string | null;
  coordenada_y: string | null;
  fecha_creacion: Date | null;
}

export interface IncidenciasConsultadas {
  numeroPaginas: number;
  total: number;
  incidencias: IncidenciaRow[];
}

/**
 * Consulta acceso, conteo y resultados en una misma sentencia.
 *
 * null significa que el plano no está disponible para el solicitante.
 * Una lista vacía sí puede corresponder a un plano accesible.
 */
@Injectable()
export class IncidenciasConsultaRepository {
  constructor(
    private readonly database: DatabaseService,
  ) {}

  async listarDisponibles(
    idProyecto: string,
    idPlano: string,
    idUsuario: string,
    numeroPagina: number,
    pagina: number,
    limite: number,
  ): Promise<IncidenciasConsultadas | null> {
    const resultado = await this.database.query<FilaConsulta>(
      `
        WITH disponible AS (
          SELECT plano.id_plano, plano.numero_paginas
          FROM obra.planos AS plano
          JOIN obra.proyectos AS proyecto
            ON proyecto.id_proyecto = plano.id_proyecto
          JOIN obra.usuarios AS propietario
            ON propietario.id_usuario = proyecto.id_propietario
          WHERE plano.id_proyecto = $1
            AND plano.id_plano = $2
            AND proyecto.activo = TRUE
            AND propietario.estado = 'ACTIVO'
            AND EXISTS (
              SELECT 1
              FROM obra.usuarios AS solicitante
              WHERE solicitante.id_usuario = $3
                AND solicitante.estado = 'ACTIVO'
            )
            AND (
              proyecto.id_propietario = $3
              OR EXISTS (
                SELECT 1
                FROM obra.usuario_proyecto AS colaboracion
                WHERE colaboracion.id_proyecto = proyecto.id_proyecto
                  AND colaboracion.id_usuario = $3
              )
            )
        ),
        filtradas AS (
          SELECT incidencia.*
          FROM obra.incidencias AS incidencia
          JOIN disponible
            ON disponible.id_plano = incidencia.id_plano
          WHERE incidencia.id_proyecto = $1
            AND incidencia.numero_pagina = $4
        ),
        conteo AS (
          SELECT COUNT(*)::text AS total
          FROM filtradas
        ),
        seleccion AS (
          SELECT *
          FROM filtradas
          ORDER BY fecha_creacion DESC, id_incidencia DESC
          LIMIT $5::integer
          OFFSET $6::bigint
        )
        SELECT
          disponible.numero_paginas,
          conteo.total,
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
          seleccion.fecha_creacion
        FROM disponible
        CROSS JOIN conteo
        LEFT JOIN seleccion ON TRUE
        ORDER BY seleccion.fecha_creacion DESC, seleccion.id_incidencia DESC
      `,
      [
        idProyecto,
        idPlano,
        idUsuario,
        numeroPagina,
        limite,
        (pagina - 1) * limite,
      ],
    );

    const primera = resultado.rows[0];

    if (!primera) {
      return null;
    }

    const total = Number(primera.total);

    if (
      typeof primera.total !== 'string' ||
      !/^\d+$/.test(primera.total) ||
      primera.total.includes('\n') ||
      !Number.isSafeInteger(total) ||
      total < 0 ||
      !Number.isInteger(primera.numero_paginas) ||
      primera.numero_paginas < 1
    ) {
      throw new Error('La consulta de incidencias devolvió datos inválidos.');
    }

    const incidencias: IncidenciaRow[] = [];

    for (const fila of resultado.rows) {
      if (fila.id_incidencia === null) {
        continue;
      }

      if (
        fila.id_proyecto === null ||
        fila.id_plano === null ||
        fila.id_creador === null ||
        fila.titulo === null ||
        fila.descripcion === null ||
        fila.estado === null ||
        fila.prioridad === null ||
        fila.numero_pagina === null ||
        fila.coordenada_x === null ||
        fila.coordenada_y === null ||
        fila.fecha_creacion === null
      ) {
        throw new Error('La consulta devolvió una incidencia incompleta.');
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
        fecha_creacion: fila.fecha_creacion,
      });
    }

    return {
      numeroPaginas: primera.numero_paginas,
      total,
      incidencias,
    };
  }
}