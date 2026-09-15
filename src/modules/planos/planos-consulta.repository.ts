import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import type { PlanoRow } from './types/plano.types';
import type {
  ResultadoConsultaPlanos,
} from './types/planos-paginados.types';

/**
 * El LEFT JOIN conserva el total aunque la página esté vacía.
 * En ese caso, todas las columnas del plano llegan como null.
 */
type PlanoPaginaRow = (
  | PlanoRow
  | { [K in keyof PlanoRow]: null }
) & { total: string };

@Injectable()
export class PlanosConsultaRepository {
  constructor(
    private readonly database: DatabaseService,
  ) {}

  /**
   * Comprueba permisos, cuenta y pagina en una sola sentencia.
   *
   * El administrador global no obtiene acceso adicional.
   * pagina y limite deben llegar validados.
   */
  async findDisponiblesPaginadas(
    idProyecto: string,
    idUsuario: string,
    pagina: number,
    limite: number,
  ): Promise<ResultadoConsultaPlanos> {
    const desplazamiento = (pagina - 1) * limite;

    const resultado = await this.database.query<PlanoPaginaRow>(
      `
        WITH proyecto_disponible AS (
          SELECT p.id_proyecto
          FROM obra.proyectos AS p
          INNER JOIN obra.usuarios AS propietario
            ON propietario.id_usuario = p.id_propietario
          INNER JOIN obra.usuarios AS solicitante
            ON solicitante.id_usuario = $2::uuid
          WHERE p.id_proyecto = $1::uuid
            AND p.activo = TRUE
            AND propietario.estado = 'ACTIVO'
            AND solicitante.estado = 'ACTIVO'
            AND (
              p.id_propietario = solicitante.id_usuario
              OR EXISTS (
                SELECT 1
                FROM obra.usuario_proyecto AS relacion
                WHERE relacion.id_proyecto = p.id_proyecto
                  AND relacion.id_usuario = solicitante.id_usuario
              )
            )
        ),
        conteo AS (
          SELECT (
            SELECT COUNT(*)::text
            FROM obra.planos AS plano
            WHERE plano.id_proyecto = proyecto.id_proyecto
          ) AS total
          FROM proyecto_disponible AS proyecto
        ),
        pagina_seleccionada AS (
          SELECT
            plano.id_plano,
            plano.id_proyecto,
            plano.id_usuario_subida,
            plano.titulo,
            plano.descripcion,
            plano.url,
            plano.s3_key,
            plano.mime_type,
            plano.fecha_subida
          FROM obra.planos AS plano
          INNER JOIN proyecto_disponible AS proyecto
            ON proyecto.id_proyecto = plano.id_proyecto
          ORDER BY plano.fecha_subida DESC, plano.id_plano DESC
          LIMIT $3::integer
          OFFSET $4::bigint
        )
        SELECT pagina.*, conteo.total
        FROM conteo
        LEFT JOIN pagina_seleccionada AS pagina ON TRUE
        ORDER BY pagina.fecha_subida DESC, pagina.id_plano DESC
      `,
      [idProyecto, idUsuario, limite, desplazamiento],
    );

    const primera = resultado.rows[0];

    if (primera === undefined) {
      return null;
    }

    if (
      typeof primera.total !== 'string' ||
      !/^[0-9]+$/.test(primera.total) ||
      primera.total.includes('\n')
    ) {
      throw new Error('El conteo de planos tiene un formato inesperado.');
    }

    const total = Number(primera.total);

    if (!Number.isSafeInteger(total) || total < 0) {
      throw new Error(
        'El total de planos no puede representarse correctamente.',
      );
    }

    const planos: PlanoRow[] = [];

    for (const fila of resultado.rows) {
      if (fila.id_plano === null) {
        continue;
      }

      planos.push({
        id_plano: fila.id_plano,
        id_proyecto: fila.id_proyecto,
        id_usuario_subida: fila.id_usuario_subida,
        titulo: fila.titulo,
        descripcion: fila.descripcion,
        url: fila.url,
        s3_key: fila.s3_key,
        mime_type: fila.mime_type,
        fecha_subida: fila.fecha_subida,
      });
    }

    return { planos, total };
  }
}