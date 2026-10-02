import { Injectable } from '@nestjs/common';

import {
  DatabaseService,
} from '../../database/database.service';

import type {
  NotificacionRow,
} from './types/notificacion.types';

type FilaPagina = (
  | NotificacionRow
  | {
      [K in keyof NotificacionRow]:
        null;
    }
) & {
  total: string;
};

export interface NotificacionesConsultadas {
  notificaciones:
    NotificacionRow[];

  total:
    number;
}

@Injectable()
export class NotificacionesConsultaRepository {
  constructor(
    private readonly database:
      DatabaseService,
  ) {}

  async listarDisponibles(
    idUsuario: string,
    pagina: number,
    limite: number,
  ): Promise<NotificacionesConsultadas> {
    const resultado =
      await this.database.query<FilaPagina>(
        `
          WITH disponibles AS (
            SELECT
              notificacion.id_notificacion,
              notificacion.id_receptor,
              notificacion.id_actor,
              notificacion.id_proyecto,
              proyecto.nombre AS nombre_proyecto,
              notificacion.id_incidencia,
              notificacion.tipo,
              notificacion.titulo,
              notificacion.mensaje,
              notificacion.destino,
              notificacion.id_recurso,
              notificacion.estado_envio_correo,
              notificacion.leida,
              notificacion.fecha_leida,
              notificacion.fecha_creacion

            FROM obra.notificaciones
              AS notificacion

            JOIN obra.usuarios
              AS receptor
              ON receptor.id_usuario =
                notificacion.id_receptor

            JOIN obra.proyectos
              AS proyecto
              ON proyecto.id_proyecto =
                notificacion.id_proyecto

            JOIN obra.usuarios
              AS propietario
              ON propietario.id_usuario =
                proyecto.id_propietario

            WHERE
              notificacion.id_receptor =
                $1::uuid

              AND receptor.estado =
                'ACTIVO'

              AND propietario.estado =
                'ACTIVO'

              AND (
                /*
                 * Notificaciones normales:
                 * el proyecto sigue activo y el receptor
                 * todavía tiene acceso.
                 */
                (
                  proyecto.activo =
                    TRUE

                  AND (
                    proyecto.id_propietario =
                      $1::uuid

                    OR EXISTS (
                      SELECT 1

                      FROM obra.usuario_proyecto
                        AS colaboracion

                      WHERE
                        colaboracion.id_proyecto =
                          proyecto.id_proyecto

                        AND colaboracion.id_usuario =
                          $1::uuid
                    )
                  )
                )

                OR

                /*
                 * Notificación personal al colaborador retirado.
                 *
                 * En este momento ya no existe la relación
                 * usuario_proyecto, por lo que debe conservarse
                 * visible expresamente.
                 *
                 * destino NULL distingue este aviso personal
                 * de la notificación COLABORADOR_RETIRADO que
                 * reciben quienes continúan en el proyecto.
                 */
                (
                  notificacion.tipo =
                    'COLABORADOR_RETIRADO'

                  AND notificacion.destino
                    IS NULL
                )
              )
          ),

          conteo AS (
            SELECT
              COUNT(*)::text
                AS total

            FROM disponibles
          ),

          seleccion AS (
            SELECT
              *

            FROM disponibles

            ORDER BY
              fecha_creacion DESC,
              id_notificacion DESC

            LIMIT
              $2::integer

            OFFSET
              $3::bigint
          )

          SELECT
            seleccion.id_notificacion,
            seleccion.id_receptor,
            seleccion.id_actor,
            seleccion.id_proyecto,
            seleccion.nombre_proyecto,
            seleccion.id_incidencia,
            seleccion.tipo,
            seleccion.titulo,
            seleccion.mensaje,
            seleccion.destino,
            seleccion.id_recurso,
            seleccion.estado_envio_correo,
            seleccion.leida,
            seleccion.fecha_leida,
            seleccion.fecha_creacion,
            conteo.total

          FROM conteo

          LEFT JOIN seleccion
            ON TRUE

          ORDER BY
            seleccion.fecha_creacion DESC,
            seleccion.id_notificacion DESC
        `,
        [
          idUsuario,
          limite,
          (
            pagina -
            1
          ) *
            limite,
        ],
      );

    const primera =
      resultado.rows[0];

    if (
      !primera ||
      typeof primera.total !==
        'string' ||
      primera.total.includes(
        '\n',
      ) ||
      primera.total.includes(
        '\r',
      ) ||
      !/^\d+$/.test(
        primera.total,
      )
    ) {
      throw new Error(
        'El conteo de notificaciones tiene un formato inesperado.',
      );
    }

    const total =
      Number(
        primera.total,
      );

    if (
      !Number.isSafeInteger(
        total,
      ) ||
      total <
        0
    ) {
      throw new Error(
        'El total de notificaciones no puede representarse correctamente.',
      );
    }

    const notificaciones:
      NotificacionRow[] =
        [];

    for (
      const fila of
      resultado.rows
    ) {
      if (
        fila.id_notificacion ===
        null
      ) {
        continue;
      }

      notificaciones.push({
        id_notificacion:
          fila.id_notificacion,

        id_receptor:
          fila.id_receptor,

        id_actor:
          fila.id_actor,

        id_proyecto:
          fila.id_proyecto,

        nombre_proyecto:
          fila.nombre_proyecto,

        id_incidencia:
          fila.id_incidencia,

        tipo:
          fila.tipo,

        titulo:
          fila.titulo,

        mensaje:
          fila.mensaje,

        destino:
          fila.destino,

        id_recurso:
          fila.id_recurso,

        estado_envio_correo:
          fila.estado_envio_correo,

        leida:
          fila.leida,

        fecha_leida:
          fila.fecha_leida,

        fecha_creacion:
          fila.fecha_creacion,
      });
    }

    return {
      notificaciones,
      total,
    };
  }

  /**
   * Comprueba si una notificación continúa apuntando
   * a un recurso existente.
   *
   * Las notificaciones informativas sin id_recurso
   * permanecen vigentes.
   */
  async estaVigente(
    idUsuario: string,
    idNotificacion: string,
  ): Promise<boolean> {
    const resultado =
      await this.database.query<{
        vigente: boolean;
      }>(
        `
          SELECT
            CASE
              WHEN notificacion.id_notificacion
                IS NULL
              THEN FALSE

              WHEN notificacion.id_recurso
                IS NULL
              THEN TRUE

              WHEN notificacion.destino =
                'MAPA'
              THEN EXISTS (
                SELECT 1

                FROM obra.incidencias
                  AS incidencia

                WHERE
                  incidencia.id_incidencia =
                    notificacion.id_recurso

                  AND incidencia.id_proyecto =
                    notificacion.id_proyecto
              )

              WHEN notificacion.destino =
                'FOTOGRAFIAS'
              THEN EXISTS (
                SELECT 1

                FROM obra.fotografias
                  AS fotografia

                WHERE
                  fotografia.id_fotografia =
                    notificacion.id_recurso

                  AND fotografia.id_proyecto =
                    notificacion.id_proyecto
              )

              WHEN notificacion.destino =
                'PLANOS'
              THEN EXISTS (
                SELECT 1

                FROM obra.planos
                  AS plano

                WHERE
                  plano.id_plano =
                    notificacion.id_recurso

                  AND plano.id_proyecto =
                    notificacion.id_proyecto
              )

              WHEN notificacion.destino =
                'PANORAMICAS'
              THEN EXISTS (
                SELECT 1

                FROM obra.panoramicas
                  AS panoramica

                WHERE
                  panoramica.id_panoramica =
                    notificacion.id_recurso

                  AND panoramica.id_proyecto =
                    notificacion.id_proyecto
              )

              WHEN notificacion.destino =
                'CAPAS'
              THEN EXISTS (
                SELECT 1

                FROM obra.capas
                  AS capa

                WHERE
                  capa.id_capa =
                    notificacion.id_recurso

                  AND capa.id_proyecto =
                    notificacion.id_proyecto
              )

              ELSE TRUE
            END AS vigente

          FROM (
            SELECT
              notificacion.*

            FROM obra.notificaciones
              AS notificacion

            WHERE
              notificacion.id_notificacion =
                $1::uuid

              AND notificacion.id_receptor =
                $2::uuid

            LIMIT 1
          ) AS notificacion

          RIGHT JOIN (
            SELECT 1
          ) AS siempre
            ON TRUE
        `,
        [
          idNotificacion,
          idUsuario,
        ],
      );

    return (
      resultado.rows[0]
        ?.vigente ===
      true
    );
  }
}