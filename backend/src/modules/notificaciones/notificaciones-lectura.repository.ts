import { Injectable } from '@nestjs/common';

import {
  DatabaseService,
} from '../../database/database.service';

@Injectable()
export class NotificacionesLecturaRepository {
  constructor(
    private readonly database:
      DatabaseService,
  ) {}

  async contarNoLeidas(
    idUsuario: string,
  ): Promise<number> {
    const resultado =
      await this.database.query<{
        total: string;
      }>(
        `
          SELECT
            COUNT(*)::text AS total

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

            AND notificacion.leida =
              FALSE

            AND receptor.estado =
              'ACTIVO'

            AND propietario.estado =
              'ACTIVO'

            AND (
              /*
               * Notificaciones normales:
               * el usuario todavía tiene acceso al proyecto.
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
               * Aviso personal para un colaborador
               * que acaba de perder el acceso.
               */
              (
                notificacion.tipo =
                  'COLABORADOR_RETIRADO'

                AND notificacion.destino
                  IS NULL
              )
            )
        `,
        [
          idUsuario,
        ],
      );

    const total =
      Number(
        resultado.rows[0]
          ?.total ??
          '0',
      );

    if (
      !Number.isSafeInteger(
        total,
      ) ||
      total <
        0
    ) {
      throw new Error(
        'El conteo de notificaciones no leídas es inválido.',
      );
    }

    return total;
  }

  async marcarLeida(
    idUsuario: string,
    idNotificacion: string,
  ): Promise<boolean> {
    const resultado =
      await this.database.query(
        `
          UPDATE obra.notificaciones

          SET
            leida = TRUE,
            fecha_leida =
              CURRENT_TIMESTAMP

          WHERE
            id_notificacion =
              $1::uuid

            AND id_receptor =
              $2::uuid

            AND leida =
              FALSE
        `,
        [
          idNotificacion,
          idUsuario,
        ],
      );

    return (
      resultado.rowCount ===
      1
    );
  }

  async marcarTodasLeidas(
    idUsuario: string,
  ): Promise<number> {
    const resultado =
      await this.database.query(
        `
          UPDATE obra.notificaciones

          SET
            leida = TRUE,
            fecha_leida =
              CURRENT_TIMESTAMP

          WHERE
            id_receptor =
              $1::uuid

            AND leida =
              FALSE
        `,
        [
          idUsuario,
        ],
      );

    return (
      resultado.rowCount ??
      0
    );
  }

  async eliminar(
    idUsuario: string,
    idNotificacion: string,
  ): Promise<boolean> {
    const resultado =
      await this.database.query(
        `
          DELETE FROM obra.notificaciones

          WHERE
            id_notificacion =
              $1::uuid

            AND id_receptor =
              $2::uuid
        `,
        [
          idNotificacion,
          idUsuario,
        ],
      );

    return (
      resultado.rowCount ===
      1
    );
  }
}