import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import type {
  DestinoNotificacion,
} from './types/notificacion.types';

export interface CrearNotificacionInput {
  id_receptor: string;

  id_actor: string;

  id_proyecto: string;

  id_incidencia:
    string | null;

  tipo: string;

  titulo: string;

  mensaje: string;

  destino?:
    DestinoNotificacion | null;

  id_recurso?:
    string | null;
}

export interface CrearNotificacionProyectoInput {
  id_actor: string;

  id_proyecto: string;

  id_incidencia:
    string | null;

  tipo: string;

  titulo: string;

  mensaje: string;

  destino:
    DestinoNotificacion;

  id_recurso:
    string | null;
}

@Injectable()
export class NotificacionesRepository {
  async crear(
    client: PoolClient,
    datos: CrearNotificacionInput,
  ): Promise<void> {
    const resultado =
      await client.query(
        `
          INSERT INTO obra.notificaciones (
            id_receptor,
            id_actor,
            id_proyecto,
            id_incidencia,
            tipo,
            titulo,
            mensaje,
            destino,
            id_recurso
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9
          )
        `,
        [
          datos.id_receptor,
          datos.id_actor,
          datos.id_proyecto,
          datos.id_incidencia,
          datos.tipo,
          datos.titulo,
          datos.mensaje,
          datos.destino ?? null,
          datos.id_recurso ?? null,
        ],
      );

    if (
      resultado.rowCount !==
      1
    ) {
      throw new Error(
        'No se pudo registrar exactamente una notificación.',
      );
    }
  }

  async crearParaParticipantesProyecto(
    client: PoolClient,
    datos: CrearNotificacionProyectoInput,
  ): Promise<number> {
    const resultado =
      await client.query(
        `
          INSERT INTO obra.notificaciones (
            id_receptor,
            id_actor,
            id_proyecto,
            id_incidencia,
            tipo,
            titulo,
            mensaje,
            destino,
            id_recurso
          )
          SELECT
            destinatario.id_usuario,
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4,
            $5,
            $6,
            $7,
            $8::uuid

          FROM (
            SELECT
              proyecto.id_propietario
                AS id_usuario

            FROM obra.proyectos
              AS proyecto

            WHERE
              proyecto.id_proyecto =
                $2::uuid

            UNION

            SELECT
              colaboracion.id_usuario

            FROM obra.usuario_proyecto
              AS colaboracion

            WHERE
              colaboracion.id_proyecto =
                $2::uuid
          ) AS destinatario

          JOIN obra.usuarios
            AS receptor
            ON receptor.id_usuario =
              destinatario.id_usuario

          WHERE
            destinatario.id_usuario <>
              $1::uuid

            AND receptor.estado =
              'ACTIVO'
        `,
        [
          datos.id_actor,
          datos.id_proyecto,
          datos.id_incidencia,
          datos.tipo,
          datos.titulo,
          datos.mensaje,
          datos.destino,
          datos.id_recurso,
        ],
      );

    return (
      resultado.rowCount ??
      0
    );
  }

  /**
   * Notifica directamente al colaborador que acaba
   * de ser retirado del proyecto.
   *
   * Esta notificación no tiene destino porque el receptor
   * ya no dispone de acceso al proyecto.
   */
  async crearRetiroColaborador(
    client: PoolClient,
    idActor: string,
    idProyecto: string,
    idColaborador: string,
  ): Promise<void> {
    const resultado =
      await client.query(
        `
          INSERT INTO obra.notificaciones (
            id_receptor,
            id_actor,
            id_proyecto,
            id_incidencia,
            tipo,
            titulo,
            mensaje,
            destino,
            id_recurso
          )

          SELECT
            receptor.id_usuario,
            actor.id_usuario,
            proyecto.id_proyecto,
            NULL,
            'COLABORADOR_RETIRADO',
            'Te eliminaron del proyecto',

            CONCAT(
              COALESCE(
                NULLIF(
                  TRIM(
                    CONCAT_WS(
                      ' ',
                      actor.nombre,
                      actor.apellidos
                    )
                  ),
                  ''
                ),
                actor.correo
              ),
              ' te ha eliminado del proyecto "',
              proyecto.nombre,
              '".'
            ),

            NULL,
            NULL

          FROM obra.usuarios
            AS actor

          JOIN obra.proyectos
            AS proyecto
            ON proyecto.id_proyecto =
              $2::uuid

          JOIN obra.usuarios
            AS receptor
            ON receptor.id_usuario =
              $3::uuid

          WHERE
            actor.id_usuario =
              $1::uuid

            AND receptor.estado =
              'ACTIVO'
        `,
        [
          idActor,
          idProyecto,
          idColaborador,
        ],
      );

    if (
      resultado.rowCount !==
      1
    ) {
      throw new Error(
        'No fue posible crear la notificación para el colaborador retirado.',
      );
    }
  }
}