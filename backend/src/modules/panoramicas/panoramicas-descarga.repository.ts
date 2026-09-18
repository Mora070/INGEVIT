import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import type { MimePanoramica } from './types/panoramica.types';

export interface PanoramicaDescargable {
  s3_key: string;
  mime_type: MimePanoramica;
}

/**
 * Comprueba acceso y selecciona el archivo en una misma consulta.
 * El rol global de administrador no concede acceso adicional.
 */
@Injectable()
export class PanoramicasDescargaRepository {
  constructor(
    private readonly database: DatabaseService,
  ) {}

  async buscarDisponible(
    idProyecto: string,
    idUsuario: string,
    clave: string,
  ): Promise<PanoramicaDescargable | null> {
    const resultado = await this.database.query<PanoramicaDescargable>(
      `
        SELECT panoramica.s3_key, panoramica.mime_type
        FROM obra.panoramicas AS panoramica
        JOIN obra.proyectos AS proyecto
          ON proyecto.id_proyecto = panoramica.id_proyecto
        JOIN obra.usuarios AS propietario
          ON propietario.id_usuario = proyecto.id_propietario
        WHERE panoramica.id_proyecto = $1
          AND panoramica.s3_key = $3
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

    const fila = resultado.rows[0];

    return fila
      ? { s3_key: fila.s3_key, mime_type: fila.mime_type }
      : null;
  }
}