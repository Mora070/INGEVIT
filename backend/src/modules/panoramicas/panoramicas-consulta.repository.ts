import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import type { PanoramicaRow } from './types/panoramica.types';

type FilaPagina = (
  | PanoramicaRow
  | { [K in keyof PanoramicaRow]: null }
) & { total: string };

export interface PanoramicasConsultadas {
  panoramicas: PanoramicaRow[];
  total: number;
}

/**
 * Comprueba acceso, cuenta y pagina en una misma sentencia.
 * El LEFT JOIN conserva el total aunque la página esté vacía.
 */
@Injectable()
export class PanoramicasConsultaRepository {
  constructor(
    private readonly database: DatabaseService,
  ) {}

  async listarDisponibles(
    idProyecto: string,
    idUsuario: string,
    pagina: number,
    limite: number,
  ): Promise<PanoramicasConsultadas | null> {
    const resultado = await this.database.query<FilaPagina>(
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
                FROM obra.usuario_proyecto AS relacion
                WHERE relacion.id_proyecto = proyecto.id_proyecto
                  AND relacion.id_usuario = solicitante.id_usuario
              )
            )
        ),
        conteo AS (
          SELECT (
            SELECT COUNT(*)::text
            FROM obra.panoramicas AS imagen
            WHERE imagen.id_proyecto = disponible.id_proyecto
          ) AS total
          FROM disponible
        ),
        seleccion AS (
          SELECT imagen.*
          FROM obra.panoramicas AS imagen
          JOIN disponible
            ON disponible.id_proyecto = imagen.id_proyecto
          ORDER BY imagen.fecha_subida DESC, imagen.id_panoramica DESC
          LIMIT $3::integer
          OFFSET $4::bigint
        )
        SELECT
          seleccion.id_panoramica,
          seleccion.id_proyecto,
          seleccion.id_usuario_subida,
          seleccion.titulo,
          seleccion.url,
          seleccion.s3_key,
          seleccion.mime_type,
          seleccion.fecha_subida,
          conteo.total
        FROM conteo
        LEFT JOIN seleccion ON TRUE
        ORDER BY seleccion.fecha_subida DESC, seleccion.id_panoramica DESC
      `,
      [idProyecto, idUsuario, limite, (pagina - 1) * limite],
    );

    const primera = resultado.rows[0];

    if (!primera) return null;

    if (
      typeof primera.total !== 'string' ||
      primera.total.includes('\n') ||
      primera.total.includes('\r') ||
      !/^\d+$/.test(primera.total)
    ) {
      throw new Error('El conteo de panorámicas tiene un formato inesperado.');
    }

    const total = Number(primera.total);

    if (!Number.isSafeInteger(total) || total < 0) {
      throw new Error('El total de panorámicas no puede representarse correctamente.');
    }

    const panoramicas: PanoramicaRow[] = [];

    for (const fila of resultado.rows) {
      if (fila.id_panoramica === null) continue;

      panoramicas.push({
        id_panoramica: fila.id_panoramica,
        id_proyecto: fila.id_proyecto,
        id_usuario_subida: fila.id_usuario_subida,
        titulo: fila.titulo,
        url: fila.url,
        s3_key: fila.s3_key,
        mime_type: fila.mime_type,
        fecha_subida: fila.fecha_subida,
      });
    }

    return { panoramicas, total };
  }
}