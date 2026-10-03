import {
  Injectable,
} from '@nestjs/common';

import type {
  PoolClient,
} from 'pg';

import type {
  FotografiaRow,
} from '../fotografias/types/fotografia.types';

import type {
  PanoramicaRow,
} from '../panoramicas/types/panoramica.types';

import type {
  PlanoRow,
} from '../planos/types/plano.types';


export interface FotografiaCarpetaRow
  extends FotografiaRow {
  fecha_agregada: Date;
}

export interface PanoramicaCarpetaRow
  extends PanoramicaRow {
  fecha_agregada: Date;
}

export interface PlanoCarpetaRow
  extends PlanoRow {
  fecha_agregada: Date;
}

export interface ContenidoCarpetaRow {
  fotografias:
    FotografiaCarpetaRow[];

  panoramicas:
    PanoramicaCarpetaRow[];

  planos:
    PlanoCarpetaRow[];
}


/**
 * Administra exclusivamente la organización
 * de recursos existentes dentro de carpetas.
 *
 * No crea ni elimina fotografías, panorámicas
 * o planos originales.
 *
 * Agregar un recurso que ya se encuentra en otra
 * carpeta lo mueve a la nueva carpeta.
 */
@Injectable()
export class CarpetasRecursosRepository {
  /**
   * Agrega o mueve una fotografía a una carpeta.
   *
   * Devuelve false cuando la fotografía no existe
   * dentro del proyecto indicado.
   */
  async agregarFotografia(
    client: PoolClient,
    idProyecto: string,
    idCarpeta: string,
    idFotografia: string,
    idUsuario: string,
  ): Promise<boolean> {
    const resultado =
      await client.query(
        `
          INSERT INTO obra.carpeta_fotografias (
            id_proyecto,
            id_carpeta,
            id_fotografia,
            id_usuario_agrego
          )
          SELECT
            $1::uuid,
            $2::uuid,
            fotografia.id_fotografia,
            $4::uuid
          FROM obra.fotografias AS fotografia
          WHERE
            fotografia.id_proyecto =
              $1::uuid
            AND fotografia.id_fotografia =
              $3::uuid

          ON CONFLICT (
            id_fotografia
          )
          DO UPDATE SET
            id_proyecto =
              EXCLUDED.id_proyecto,

            id_carpeta =
              EXCLUDED.id_carpeta,

            id_usuario_agrego =
              EXCLUDED.id_usuario_agrego,

            fecha_agregada =
              CURRENT_TIMESTAMP

          RETURNING
            id_fotografia
        `,
        [
          idProyecto,
          idCarpeta,
          idFotografia,
          idUsuario,
        ],
      );

    return (
      resultado.rowCount ===
      1
    );
  }

  /**
   * Agrega o mueve una panorámica 360°
   * a una carpeta.
   */
  async agregarPanoramica(
    client: PoolClient,
    idProyecto: string,
    idCarpeta: string,
    idPanoramica: string,
    idUsuario: string,
  ): Promise<boolean> {
    const resultado =
      await client.query(
        `
          INSERT INTO obra.carpeta_panoramicas (
            id_proyecto,
            id_carpeta,
            id_panoramica,
            id_usuario_agrego
          )
          SELECT
            $1::uuid,
            $2::uuid,
            panoramica.id_panoramica,
            $4::uuid
          FROM obra.panoramicas AS panoramica
          WHERE
            panoramica.id_proyecto =
              $1::uuid
            AND panoramica.id_panoramica =
              $3::uuid

          ON CONFLICT (
            id_panoramica
          )
          DO UPDATE SET
            id_proyecto =
              EXCLUDED.id_proyecto,

            id_carpeta =
              EXCLUDED.id_carpeta,

            id_usuario_agrego =
              EXCLUDED.id_usuario_agrego,

            fecha_agregada =
              CURRENT_TIMESTAMP

          RETURNING
            id_panoramica
        `,
        [
          idProyecto,
          idCarpeta,
          idPanoramica,
          idUsuario,
        ],
      );

    return (
      resultado.rowCount ===
      1
    );
  }

  /**
   * Agrega o mueve un plano a una carpeta.
   */
  async agregarPlano(
    client: PoolClient,
    idProyecto: string,
    idCarpeta: string,
    idPlano: string,
    idUsuario: string,
  ): Promise<boolean> {
    const resultado =
      await client.query(
        `
          INSERT INTO obra.carpeta_planos (
            id_proyecto,
            id_carpeta,
            id_plano,
            id_usuario_agrego
          )
          SELECT
            $1::uuid,
            $2::uuid,
            plano.id_plano,
            $4::uuid
          FROM obra.planos AS plano
          WHERE
            plano.id_proyecto =
              $1::uuid
            AND plano.id_plano =
              $3::uuid

          ON CONFLICT (
            id_plano
          )
          DO UPDATE SET
            id_proyecto =
              EXCLUDED.id_proyecto,

            id_carpeta =
              EXCLUDED.id_carpeta,

            id_usuario_agrego =
              EXCLUDED.id_usuario_agrego,

            fecha_agregada =
              CURRENT_TIMESTAMP

          RETURNING
            id_plano
        `,
        [
          idProyecto,
          idCarpeta,
          idPlano,
          idUsuario,
        ],
      );

    return (
      resultado.rowCount ===
      1
    );
  }

  /**
   * Quita una fotografía de la carpeta.
   *
   * La fotografía original permanece intacta.
   */
  async quitarFotografia(
    client: PoolClient,
    idProyecto: string,
    idCarpeta: string,
    idFotografia: string,
  ): Promise<boolean> {
    const resultado =
      await client.query(
        `
          DELETE FROM obra.carpeta_fotografias
          WHERE
            id_proyecto =
              $1::uuid
            AND id_carpeta =
              $2::uuid
            AND id_fotografia =
              $3::uuid
        `,
        [
          idProyecto,
          idCarpeta,
          idFotografia,
        ],
      );

    return (
      resultado.rowCount ===
      1
    );
  }

  /**
   * Quita una panorámica de la carpeta.
   *
   * La panorámica original permanece intacta.
   */
  async quitarPanoramica(
    client: PoolClient,
    idProyecto: string,
    idCarpeta: string,
    idPanoramica: string,
  ): Promise<boolean> {
    const resultado =
      await client.query(
        `
          DELETE FROM obra.carpeta_panoramicas
          WHERE
            id_proyecto =
              $1::uuid
            AND id_carpeta =
              $2::uuid
            AND id_panoramica =
              $3::uuid
        `,
        [
          idProyecto,
          idCarpeta,
          idPanoramica,
        ],
      );

    return (
      resultado.rowCount ===
      1
    );
  }

  /**
   * Quita un plano de la carpeta.
   *
   * El plano original permanece intacto.
   */
  async quitarPlano(
    client: PoolClient,
    idProyecto: string,
    idCarpeta: string,
    idPlano: string,
  ): Promise<boolean> {
    const resultado =
      await client.query(
        `
          DELETE FROM obra.carpeta_planos
          WHERE
            id_proyecto =
              $1::uuid
            AND id_carpeta =
              $2::uuid
            AND id_plano =
              $3::uuid
        `,
        [
          idProyecto,
          idCarpeta,
          idPlano,
        ],
      );

    return (
      resultado.rowCount ===
      1
    );
  }

  /**
   * Obtiene todos los recursos organizados
   * directamente dentro de una carpeta.
   *
   * Las subcarpetas se consultan mediante
   * CarpetasRepository.
   */
  async listarContenido(
    client: PoolClient,
    idProyecto: string,
    idCarpeta: string,
  ): Promise<ContenidoCarpetaRow> {
    const fotografias =
      await client.query<
        FotografiaCarpetaRow
      >(
        `
          SELECT
            fotografia.id_fotografia,
            fotografia.id_proyecto,
            fotografia.id_usuario_subida,
            fotografia.titulo,
            fotografia.url,
            fotografia.s3_key,
            fotografia.original_s3_key,
            fotografia.fecha_subida,
            fotografia.latitud,
            fotografia.longitud,
            fotografia.es_portada,
            relacion.fecha_agregada
          FROM obra.carpeta_fotografias
            AS relacion
          INNER JOIN obra.fotografias
            AS fotografia
            ON fotografia.id_proyecto =
              relacion.id_proyecto
            AND fotografia.id_fotografia =
              relacion.id_fotografia
          WHERE
            relacion.id_proyecto =
              $1::uuid
            AND relacion.id_carpeta =
              $2::uuid
          ORDER BY
            relacion.fecha_agregada DESC,
            fotografia.id_fotografia
        `,
        [
          idProyecto,
          idCarpeta,
        ],
      );

    const panoramicas =
      await client.query<
        PanoramicaCarpetaRow
      >(
        `
          SELECT
            panoramica.id_panoramica,
            panoramica.id_proyecto,
            panoramica.id_usuario_subida,
            panoramica.titulo,
            panoramica.url,
            panoramica.s3_key,
            panoramica.mime_type,
            panoramica.fecha_subida,
            panoramica.latitud,
            panoramica.longitud,
            relacion.fecha_agregada
          FROM obra.carpeta_panoramicas
            AS relacion
          INNER JOIN obra.panoramicas
            AS panoramica
            ON panoramica.id_proyecto =
              relacion.id_proyecto
            AND panoramica.id_panoramica =
              relacion.id_panoramica
          WHERE
            relacion.id_proyecto =
              $1::uuid
            AND relacion.id_carpeta =
              $2::uuid
          ORDER BY
            relacion.fecha_agregada DESC,
            panoramica.id_panoramica
        `,
        [
          idProyecto,
          idCarpeta,
        ],
      );

    const planos =
      await client.query<
        PlanoCarpetaRow
      >(
        `
          SELECT
            plano.id_plano,
            plano.id_proyecto,
            plano.id_usuario_subida,
            plano.titulo,
            plano.descripcion,
            plano.url,
            plano.s3_key,
            plano.mime_type,
            plano.fecha_subida,
            relacion.fecha_agregada
          FROM obra.carpeta_planos
            AS relacion
          INNER JOIN obra.planos
            AS plano
            ON plano.id_proyecto =
              relacion.id_proyecto
            AND plano.id_plano =
              relacion.id_plano
          WHERE
            relacion.id_proyecto =
              $1::uuid
            AND relacion.id_carpeta =
              $2::uuid
          ORDER BY
            relacion.fecha_agregada DESC,
            plano.id_plano
        `,
        [
          idProyecto,
          idCarpeta,
        ],
      );

    return {
      fotografias:
        fotografias.rows,

      panoramicas:
        panoramicas.rows,

      planos:
        planos.rows,
    };
  }
}