import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import type { NotificacionRow } from './types/notificacion.types';

type FilaPagina = (
  | NotificacionRow
  | { [K in keyof NotificacionRow]: null }
) & { total: string };

export interface NotificacionesConsultadas {
  notificaciones: NotificacionRow[];
  total: number;
}

/**
 * Consulta el historial disponible para el receptor autenticado.
 *
 * Aplica los mismos filtros al conteo y a los resultados.
 * El orden por fecha e identificador resuelve empates.
 */
@Injectable()
export class NotificacionesConsultaRepository {
  constructor(
    private readonly database: DatabaseService,
  ) {}

  async listarDisponibles(
    idUsuario: string,
    pagina: number,
    limite: number,
  ): Promise<NotificacionesConsultadas> {
    const resultado = await this.database.query<FilaPagina>(
      `
        WITH disponibles AS (
          SELECT notificacion.*
          FROM obra.notificaciones AS notificacion
          JOIN obra.usuarios AS receptor
            ON receptor.id_usuario = notificacion.id_receptor
          JOIN obra.proyectos AS proyecto
            ON proyecto.id_proyecto = notificacion.id_proyecto
          JOIN obra.usuarios AS propietario
            ON propietario.id_usuario = proyecto.id_propietario
          WHERE notificacion.id_receptor = $1::uuid
            AND receptor.estado = 'ACTIVO'
            AND proyecto.activo = TRUE
            AND propietario.estado = 'ACTIVO'
            AND (
              proyecto.id_propietario = $1::uuid
              OR EXISTS (
                SELECT 1
                FROM obra.usuario_proyecto AS colaboracion
                WHERE colaboracion.id_proyecto = proyecto.id_proyecto
                  AND colaboracion.id_usuario = $1::uuid
              )
            )
        ),
        conteo AS (
          SELECT COUNT(*)::text AS total
          FROM disponibles
        ),
        seleccion AS (
          SELECT *
          FROM disponibles
          ORDER BY fecha_creacion DESC, id_notificacion DESC
          LIMIT $2::integer
          OFFSET $3::bigint
        )
        SELECT
          seleccion.id_notificacion,
          seleccion.id_receptor,
          seleccion.id_actor,
          seleccion.id_proyecto,
          seleccion.id_incidencia,
          seleccion.tipo,
          seleccion.titulo,
          seleccion.mensaje,
          seleccion.estado_envio_correo,
          seleccion.fecha_creacion,
          conteo.total
        FROM conteo
        LEFT JOIN seleccion ON TRUE
        ORDER BY seleccion.fecha_creacion DESC, seleccion.id_notificacion DESC
      `,
      [idUsuario, limite, (pagina - 1) * limite],
    );

    const primera = resultado.rows[0];

    // El agregado COUNT debe devolver una fila, incluso sin notificaciones.
    if (
      !primera ||
      typeof primera.total !== 'string' ||
      primera.total.includes('\n') ||
      primera.total.includes('\r') ||
      !/^\d+$/.test(primera.total)
    ) {
      throw new Error(
        'El conteo de notificaciones tiene un formato inesperado.',
      );
    }

    const total = Number(primera.total);

    if (!Number.isSafeInteger(total) || total < 0) {
      throw new Error(
        'El total de notificaciones no puede representarse correctamente.',
      );
    }

    const notificaciones: NotificacionRow[] = [];

    for (const fila of resultado.rows) {
      if (fila.id_notificacion === null) continue;

      notificaciones.push({
        id_notificacion: fila.id_notificacion,
        id_receptor: fila.id_receptor,
        id_actor: fila.id_actor,
        id_proyecto: fila.id_proyecto,
        id_incidencia: fila.id_incidencia,
        tipo: fila.tipo,
        titulo: fila.titulo,
        mensaje: fila.mensaje,
        estado_envio_correo: fila.estado_envio_correo,
        fecha_creacion: fila.fecha_creacion,
      });
    }

    return { notificaciones, total };
  }
}