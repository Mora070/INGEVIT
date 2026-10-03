import {
  Injectable,
} from '@nestjs/common';

import type {
  PoolClient,
} from 'pg';

import type {
  CarpetaRow,
} from './types/carpeta.types';

/**
 * Administra exclusivamente la estructura jerárquica
 * de carpetas.
 *
 * Recibe siempre el cliente proporcionado por la
 * transacción del servicio.
 *
 * No abre conexiones ni confirma transacciones.
 */
@Injectable()
export class CarpetasRepository {
  /**
   * Crea una carpeta raíz o una subcarpeta.
   *
   * idCarpetaPadre = null representa la raíz
   * del proyecto.
   *
   * La base de datos garantiza que, si existe
   * una carpeta padre, pertenezca al mismo proyecto.
   */
  async crear(
    client: PoolClient,
    datos: {
      idProyecto: string;
      idCarpetaPadre: string | null;
      idUsuarioCreacion: string;
      nombre: string;
    },
  ): Promise<CarpetaRow> {
    const resultado =
      await client.query<CarpetaRow>(
        `
          INSERT INTO obra.carpetas (
            id_proyecto,
            id_carpeta_padre,
            id_usuario_creacion,
            nombre
          )
          VALUES (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4
          )
          RETURNING
            id_carpeta,
            id_proyecto,
            id_carpeta_padre,
            id_usuario_creacion,
            nombre,
            fecha_creacion,
            fecha_actualizacion
        `,
        [
          datos.idProyecto,
          datos.idCarpetaPadre,
          datos.idUsuarioCreacion,
          datos.nombre,
        ],
      );

    const carpeta =
      resultado.rows[0];

    if (
      resultado.rowCount !== 1 ||
      !carpeta
    ) {
      throw new Error(
        'La creación de la carpeta no devolvió el registro esperado.',
      );
    }

    return carpeta;
  }

  /**
   * Lista únicamente las carpetas contenidas
   * directamente dentro de una ubicación.
   *
   * idCarpetaPadre = null devuelve las carpetas
   * ubicadas en la raíz del proyecto.
   */
  async listarPorPadre(
    client: PoolClient,
    idProyecto: string,
    idCarpetaPadre: string | null,
  ): Promise<CarpetaRow[]> {
    const resultado =
      await client.query<CarpetaRow>(
        `
          SELECT
            id_carpeta,
            id_proyecto,
            id_carpeta_padre,
            id_usuario_creacion,
            nombre,
            fecha_creacion,
            fecha_actualizacion
          FROM obra.carpetas
          WHERE id_proyecto = $1::uuid
            AND id_carpeta_padre
              IS NOT DISTINCT FROM $2::uuid
          ORDER BY
            lower(btrim(nombre)),
            id_carpeta
        `,
        [
          idProyecto,
          idCarpetaPadre,
        ],
      );

    return resultado.rows;
  }

  /**
   * Obtiene una carpeta concreta sin bloquearla.
   *
   * Devuelve null si no pertenece al proyecto
   * indicado o si no existe.
   */
  async buscarPorId(
    client: PoolClient,
    idProyecto: string,
    idCarpeta: string,
  ): Promise<CarpetaRow | null> {
    const resultado =
      await client.query<CarpetaRow>(
        `
          SELECT
            id_carpeta,
            id_proyecto,
            id_carpeta_padre,
            id_usuario_creacion,
            nombre,
            fecha_creacion,
            fecha_actualizacion
          FROM obra.carpetas
          WHERE id_proyecto = $1::uuid
            AND id_carpeta = $2::uuid
          LIMIT 1
        `,
        [
          idProyecto,
          idCarpeta,
        ],
      );

    return (
      resultado.rows[0] ??
      null
    );
  }

  /**
   * Bloquea una carpeta para modificación dentro
   * de la transacción actual.
   *
   * Se utilizará antes de renombrar, mover
   * o eliminar.
   */
  async bloquear(
    client: PoolClient,
    idProyecto: string,
    idCarpeta: string,
  ): Promise<CarpetaRow | null> {
    const resultado =
      await client.query<CarpetaRow>(
        `
          SELECT
            id_carpeta,
            id_proyecto,
            id_carpeta_padre,
            id_usuario_creacion,
            nombre,
            fecha_creacion,
            fecha_actualizacion
          FROM obra.carpetas
          WHERE id_proyecto = $1::uuid
            AND id_carpeta = $2::uuid
          FOR UPDATE
        `,
        [
          idProyecto,
          idCarpeta,
        ],
      );

    return (
      resultado.rows[0] ??
      null
    );
  }

  /**
   * Bloquea el proyecto mientras se modifica
   * su árbol de carpetas.
   *
   * Esto serializa movimientos estructurales
   * concurrentes del mismo proyecto y facilita
   * impedir ciclos en la jerarquía.
   */
  async bloquearEstructuraProyecto(
    client: PoolClient,
    idProyecto: string,
  ): Promise<boolean> {
    const resultado =
      await client.query(
        `
          SELECT id_proyecto
          FROM obra.proyectos
          WHERE id_proyecto = $1::uuid
          FOR UPDATE
        `,
        [
          idProyecto,
        ],
      );

    return (
      resultado.rowCount ===
      1
    );
  }

  /**
   * Comprueba si una carpeta candidata se encuentra
   * dentro de los descendientes de otra.
   *
   * Ejemplo:
   *
   * Edificio 1
   * └── Piso 1
   *     └── Apartamento 1
   *
   * Si queremos mover "Edificio 1" dentro de
   * "Apartamento 1", este método devolverá true.
   *
   * Esto permite impedir ciclos indirectos.
   */
  async esDescendiente(
    client: PoolClient,
    idProyecto: string,
    idCarpeta: string,
    idPosibleDescendiente: string,
  ): Promise<boolean> {
    const resultado =
      await client.query<{
        existe: boolean;
      }>(
        `
          WITH RECURSIVE descendientes AS (
            SELECT
              carpeta.id_carpeta
            FROM obra.carpetas AS carpeta
            WHERE
              carpeta.id_proyecto = $1::uuid
              AND carpeta.id_carpeta_padre = $2::uuid

            UNION ALL

            SELECT
              hija.id_carpeta
            FROM obra.carpetas AS hija
            INNER JOIN descendientes AS padre
              ON padre.id_carpeta =
                hija.id_carpeta_padre
            WHERE
              hija.id_proyecto = $1::uuid
          )
          SELECT EXISTS (
            SELECT 1
            FROM descendientes
            WHERE
              id_carpeta = $3::uuid
          ) AS existe
        `,
        [
          idProyecto,
          idCarpeta,
          idPosibleDescendiente,
        ],
      );

    return (
      resultado.rows[0]?.existe ===
      true
    );
  }

  /**
   * Renombra una carpeta.
   *
   * La restricción única de PostgreSQL sigue siendo
   * la protección final contra nombres duplicados
   * dentro de la misma ubicación.
   */
  async actualizarNombre(
    client: PoolClient,
    idProyecto: string,
    idCarpeta: string,
    nombre: string,
  ): Promise<CarpetaRow | null> {
    const resultado =
      await client.query<CarpetaRow>(
        `
          UPDATE obra.carpetas
          SET
            nombre = $3,
            fecha_actualizacion =
              CURRENT_TIMESTAMP
          WHERE id_proyecto = $1::uuid
            AND id_carpeta = $2::uuid
          RETURNING
            id_carpeta,
            id_proyecto,
            id_carpeta_padre,
            id_usuario_creacion,
            nombre,
            fecha_creacion,
            fecha_actualizacion
        `,
        [
          idProyecto,
          idCarpeta,
          nombre,
        ],
      );

    if (
      resultado.rowCount ===
      0
    ) {
      return null;
    }

    const carpeta =
      resultado.rows[0];

    if (
      resultado.rowCount !== 1 ||
      !carpeta
    ) {
      throw new Error(
        'La actualización de la carpeta no devolvió el registro esperado.',
      );
    }

    return carpeta;
  }

  /**
   * Mueve una carpeta a otra ubicación.
   *
   * idCarpetaPadre = null la devuelve a
   * la raíz del proyecto.
   *
   * Este método NO decide si el movimiento
   * formaría un ciclo. Esa validación corresponde
   * al servicio antes de ejecutar el UPDATE.
   */
  async mover(
    client: PoolClient,
    idProyecto: string,
    idCarpeta: string,
    idCarpetaPadre: string | null,
  ): Promise<CarpetaRow | null> {
    const resultado =
      await client.query<CarpetaRow>(
        `
          UPDATE obra.carpetas
          SET
            id_carpeta_padre = $3::uuid,
            fecha_actualizacion =
              CURRENT_TIMESTAMP
          WHERE id_proyecto = $1::uuid
            AND id_carpeta = $2::uuid
          RETURNING
            id_carpeta,
            id_proyecto,
            id_carpeta_padre,
            id_usuario_creacion,
            nombre,
            fecha_creacion,
            fecha_actualizacion
        `,
        [
          idProyecto,
          idCarpeta,
          idCarpetaPadre,
        ],
      );

    if (
      resultado.rowCount ===
      0
    ) {
      return null;
    }

    const carpeta =
      resultado.rows[0];

    if (
      resultado.rowCount !== 1 ||
      !carpeta
    ) {
      throw new Error(
        'El movimiento de la carpeta no devolvió el registro esperado.',
      );
    }

    return carpeta;
  }

  /**
   * Elimina una carpeta.
   *
   * PostgreSQL elimina automáticamente:
   * - sus subcarpetas;
   * - las asociaciones con fotografías;
   * - las asociaciones con panorámicas;
   * - las asociaciones con planos.
   *
   * Los recursos originales NO se eliminan.
   */
  async eliminar(
    client: PoolClient,
    idProyecto: string,
    idCarpeta: string,
  ): Promise<CarpetaRow | null> {
    const resultado =
      await client.query<CarpetaRow>(
        `
          DELETE FROM obra.carpetas
          WHERE id_proyecto = $1::uuid
            AND id_carpeta = $2::uuid
          RETURNING
            id_carpeta,
            id_proyecto,
            id_carpeta_padre,
            id_usuario_creacion,
            nombre,
            fecha_creacion,
            fecha_actualizacion
        `,
        [
          idProyecto,
          idCarpeta,
        ],
      );

    if (
      resultado.rowCount ===
      0
    ) {
      return null;
    }

    const carpeta =
      resultado.rows[0];

    if (
      resultado.rowCount !== 1 ||
      !carpeta
    ) {
      throw new Error(
        'La eliminación de la carpeta no devolvió el registro esperado.',
      );
    }

    return carpeta;
  }
}