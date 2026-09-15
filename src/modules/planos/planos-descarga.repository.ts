import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

export interface PlanoDescargable {
  s3_key: string;
}

/**
 * Selecciona el archivo y comprueba el acceso en una misma consulta.
 *
 * No concede permisos adicionales por el rol global de administrador.
 * Devuelve null tanto para archivos inexistentes como no autorizados.
 */
@Injectable()
export class PlanosDescargaRepository {
  constructor(
    private readonly database: DatabaseService,
  ) {}

  async buscarDisponible(
    idProyecto: string,
    idUsuario: string,
    clave: string,
  ): Promise<PlanoDescargable | null> {
    const resultado = await this.database.query<{
      s3_key: string;
    }>(
      `
        SELECT plano.s3_key
        FROM obra.planos AS plano
        INNER JOIN obra.proyectos AS proyecto
          ON proyecto.id_proyecto = plano.id_proyecto
        INNER JOIN obra.usuarios AS propietario
          ON propietario.id_usuario = proyecto.id_propietario
        WHERE plano.id_proyecto = $1
          AND plano.s3_key = $3
          AND proyecto.activo = TRUE
          AND propietario.estado = 'ACTIVO'
          AND EXISTS (
            SELECT 1
            FROM obra.usuarios AS solicitante
            WHERE solicitante.id_usuario = $2
              AND solicitante.estado = 'ACTIVO'
          )
          AND (
            proyecto.id_propietario = $2
            OR EXISTS (
              SELECT 1
              FROM obra.usuario_proyecto AS colaboracion
              WHERE colaboracion.id_proyecto = proyecto.id_proyecto
                AND colaboracion.id_usuario = $2
            )
          )
      `,
      [idProyecto, idUsuario, clave],
    );

    const plano = resultado.rows[0];

    return plano ? { s3_key: plano.s3_key } : null;
  }
}