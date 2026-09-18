import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

/**
 * Información interna necesaria para abrir la versión optimizada.
 *
 * La clave se obtiene de PostgreSQL después de comprobar el acceso.
 * No se devuelve directamente al cliente.
 */
export interface FotografiaDescargable {
  s3_key: string;
}

/**
 * Consulta fotografías optimizadas disponibles para un usuario.
 *
 * La autorización y la selección del archivo se realizan en una
 * misma consulta, utilizando el estado visible en PostgreSQL
 * durante su ejecución.
 */
@Injectable()
export class FotografiasDescargaRepository {
  constructor(
    private readonly database: DatabaseService,
  ) {}

  /**
   * Devuelve la clave de la versión optimizada cuando:
   *
   * - La fotografía pertenece al proyecto indicado.
   * - El proyecto está activo.
   * - Su propietario y el solicitante están activos.
   * - El solicitante es propietario o colaborador.
   *
   * Ser administrador global no concede acceso adicional.
   *
   * Solo buscamos en s3_key. La clave del original de respaldo
   * no habilita su descarga mediante esta operación.
   *
   * Devuelve null tanto si el archivo no existe como si no
   * está disponible para el solicitante.
   */
  async buscarOptimizadaDisponible(
    idProyecto: string,
    idUsuario: string,
    s3Key: string,
  ): Promise<FotografiaDescargable | null> {
    const resultado = await this.database.query<{
      s3_key: string;
    }>(
      `
        SELECT f.s3_key
        FROM obra.fotografias AS f
        INNER JOIN obra.proyectos AS p
          ON p.id_proyecto = f.id_proyecto
        INNER JOIN obra.usuarios AS propietario
          ON propietario.id_usuario = p.id_propietario
        WHERE f.id_proyecto = $1
          AND f.s3_key = $3
          AND p.activo = TRUE
          AND propietario.estado = 'ACTIVO'
          AND EXISTS (
            SELECT 1
            FROM obra.usuarios AS solicitante
            WHERE solicitante.id_usuario = $2
              AND solicitante.estado = 'ACTIVO'
          )
          AND (
            p.id_propietario = $2
            OR EXISTS (
              SELECT 1
              FROM obra.usuario_proyecto AS colaboracion
              WHERE colaboracion.id_proyecto = p.id_proyecto
                AND colaboracion.id_usuario = $2
            )
          )
      `,
      [idProyecto, idUsuario, s3Key],
    );

    const fotografia = resultado.rows[0];

    if (fotografia === undefined) {
      return null;
    }

    return {
      s3_key: fotografia.s3_key,
    };
  }
}