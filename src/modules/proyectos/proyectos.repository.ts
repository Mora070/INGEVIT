import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import type { ProyectoRow } from './types/proyecto.types';

import type {
  ProyectoPaginaConsultaRow,
  ProyectosPaginadosRow,
} from './types/proyectos-paginados-row.types';

/**
 * Acceso a PostgreSQL para proyectos.
 *
 * Utiliza parámetros para los valores externos.
 * No recibe un rol global para conceder acceso implícito.
 */
@Injectable()
export class ProyectosRepository {
  constructor(
    private readonly database: DatabaseService,
  ) { }

  /**
   * Consulta los proyectos disponibles para el usuario indicado.
   *
   * Condiciones:
   * - El solicitante existe y está ACTIVO.
   * - El proyecto no está eliminado lógicamente.
   * - Su propietario está ACTIVO.
   * - El solicitante es propietario o colaborador.
   *
   * El identificador debe proceder de la identidad autenticada.
   *
   * No filtra por estado_proyecto:
   * ACTIVA, PAUSA y FINALIZADA son estados de trabajo,
   * no condiciones de eliminación o acceso.
   */
  async findDisponiblesByUsuario(
    idUsuario: string,
  ): Promise<ProyectoRow[]> {
    const result = await this.database.query<ProyectoRow>(
      `
        SELECT
          p.id_proyecto,
          p.id_propietario,
          p.nombre,
          p.descripcion,
          p.direccion,
          p.contratante,
          to_char(p.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
          to_char(
            p.fecha_finalizacion,
            'YYYY-MM-DD'
          ) AS fecha_finalizacion,
          p.estado_proyecto,
          p.activo,
          p.latitud,
          p.longitud
        FROM obra.proyectos AS p
        INNER JOIN obra.usuarios AS propietario
          ON propietario.id_usuario = p.id_propietario
        INNER JOIN obra.usuarios AS solicitante
          ON solicitante.id_usuario = $1::uuid
        WHERE p.activo = true
          AND propietario.estado = 'ACTIVO'
          AND solicitante.estado = 'ACTIVO'
          AND (
            p.id_propietario = solicitante.id_usuario
            OR EXISTS (
              SELECT 1
              FROM obra.usuario_proyecto AS colaboracion
              WHERE colaboracion.id_proyecto = p.id_proyecto
                AND colaboracion.id_usuario = solicitante.id_usuario
            )
          )
        ORDER BY
          p.fecha_inicio DESC,
          p.id_proyecto ASC
      `,
      [idUsuario],
    );

    return result.rows;
  }

  /**
   * Consulta una página y el total de proyectos accesibles.
   *
   * Los filtros de acceso se definen una sola vez en la CTE.
   * El conteo y la página utilizan el mismo conjunto de proyectos.
   *
   * Precondiciones:
   * - idUsuario procede de la autenticación.
   * - pagina y limite fueron validados.
   *
   * Una página sin registros conserva el total y devuelve proyectos: [].
   */
  async findDisponiblesPaginadosByUsuario(
    idUsuario: string,
    pagina: number,
    limite: number,
  ): Promise<ProyectosPaginadosRow> {
    const desplazamiento = (pagina - 1) * limite;

    const result =
      await this.database.query<ProyectoPaginaConsultaRow>(
        `
        WITH accesibles AS (
          SELECT p.*
          FROM obra.proyectos AS p
          INNER JOIN obra.usuarios AS propietario
            ON propietario.id_usuario = p.id_propietario
          INNER JOIN obra.usuarios AS solicitante
            ON solicitante.id_usuario = $1::uuid
          WHERE p.activo = true
            AND propietario.estado = 'ACTIVO'
            AND solicitante.estado = 'ACTIVO'
            AND (
              p.id_propietario = solicitante.id_usuario
              OR EXISTS (
                SELECT 1
                FROM obra.usuario_proyecto AS colaboracion
                WHERE colaboracion.id_proyecto = p.id_proyecto
                  AND colaboracion.id_usuario = solicitante.id_usuario
              )
            )
        ),
        pagina_seleccionada AS (
          SELECT *
          FROM accesibles
          ORDER BY fecha_inicio DESC, id_proyecto ASC
          LIMIT $2::integer
          OFFSET $3::bigint
        ),
        conteo AS (
          SELECT count(*)::text AS total
          FROM accesibles
        )
        SELECT
          p.id_proyecto,
          p.id_propietario,
          p.nombre,
          p.descripcion,
          p.direccion,
          p.contratante,
          to_char(p.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
          to_char(
            p.fecha_finalizacion,
            'YYYY-MM-DD'
          ) AS fecha_finalizacion,
          p.estado_proyecto,
          p.activo,
          p.latitud,
          p.longitud,
          conteo.total
        FROM conteo
        LEFT JOIN pagina_seleccionada AS p ON true
        ORDER BY p.fecha_inicio DESC, p.id_proyecto ASC
      `,
        [idUsuario, limite, desplazamiento],
      );

    /**
     * El agregado COUNT siempre produce una fila, incluso sin proyectos.
     * Una ausencia de filas indicaría un resultado inesperado.
     */
    const primeraFila = result.rows[0];

    if (primeraFila === undefined) {
      throw new Error(
        'La consulta paginada no devolvió el conteo esperado.',
      );
    }

    const total = Number(primeraFila.total);

    if (!Number.isSafeInteger(total) || total < 0) {
      throw new Error(
        'El total de proyectos no puede representarse correctamente.',
      );
    }

    const proyectos: ProyectoRow[] = [];

    for (const fila of result.rows) {
      // Descarta la fila vacía generada por el LEFT JOIN.
      if (fila.id_proyecto === null) {
        continue;
      }

      const { total: totalDeFila, ...proyecto } = fila;
      proyectos.push(proyecto);
    }

    return { proyectos, total };
  }


  /**
 * Consulta un proyecto disponible para el usuario indicado.
 *
 * Comprueba en la misma sentencia:
 * - Proyecto no eliminado lógicamente.
 * - Propietario activo.
 * - Solicitante activo.
 * - Solicitante propietario o colaborador.
 *
 * Devuelve null si el proyecto no existe o no está disponible
 * para ese usuario. No distingue públicamente ambas situaciones.
 *
 * idUsuario debe proceder de la identidad autenticada.
 */
async findDisponibleById(
  idProyecto: string,
  idUsuario: string,
): Promise<ProyectoRow | null> {
  const result = await this.database.query<ProyectoRow>(
    `
      SELECT
        p.id_proyecto,
        p.id_propietario,
        p.nombre,
        p.descripcion,
        p.direccion,
        p.contratante,
        to_char(p.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
        to_char(
          p.fecha_finalizacion,
          'YYYY-MM-DD'
        ) AS fecha_finalizacion,
        p.estado_proyecto,
        p.activo,
        p.latitud,
        p.longitud
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
            FROM obra.usuario_proyecto AS colaboracion
            WHERE colaboracion.id_proyecto = p.id_proyecto
              AND colaboracion.id_usuario = solicitante.id_usuario
          )
        )
    `,
    [idProyecto, idUsuario],
  );

  return result.rows[0] ?? null;
}

}