import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface CapaTeselasDisponible {
  id_capa: string;
  teselas_version: string;
  teselas_zoom_min: number;
  teselas_zoom_max: number;

  nombre: string;
  bbox_oeste: string | null;
  bbox_sur: string | null;
  bbox_este: string | null;
  bbox_norte: string | null;
}

/** Comprueba la publicación y el acceso actual en una sola consulta. */
@Injectable()
export class CapasTeselasRepository {
  constructor(private readonly database: DatabaseService) { }

  async buscarDisponible(
    proyecto: string, capa: string, version: string, usuario: string,
  ): Promise<CapaTeselasDisponible | null> {
    const resultado = await this.database.query<CapaTeselasDisponible>(
      `
      SELECT c.id_capa, c.teselas_version,
       c.teselas_zoom_min, c.teselas_zoom_max,
       c.nombre,
       c.bbox_oeste, c.bbox_sur, c.bbox_este, c.bbox_norte
        FROM obra.capas AS c
        JOIN obra.proyectos AS p ON p.id_proyecto = c.id_proyecto
        JOIN obra.usuarios AS propietario ON propietario.id_usuario = p.id_propietario
        JOIN obra.usuarios AS solicitante ON solicitante.id_usuario = $4::uuid
        WHERE c.id_proyecto = $1::uuid AND c.id_capa = $2::uuid
          AND c.teselas_version = $3::uuid
          AND c.estado_procesamiento = 'LISTA'
          AND c.teselas_proveedor = 'LOCAL'
          AND p.activo = true
          AND propietario.estado = 'ACTIVO'
          AND solicitante.estado = 'ACTIVO'
          AND (
            p.id_propietario = solicitante.id_usuario
            OR EXISTS (
              SELECT 1 FROM obra.usuario_proyecto AS colaboracion
              WHERE colaboracion.id_proyecto = p.id_proyecto
                AND colaboracion.id_usuario = solicitante.id_usuario
            )
          )
      `,
      [proyecto, capa, version, usuario],
    );
    return resultado.rows[0] ?? null;
  }
}
