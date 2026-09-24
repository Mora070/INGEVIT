import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { CapaRow } from './types/capa.types';

type FilaConsulta = (
  | CapaRow
  | { [K in keyof CapaRow]: null }
) & { total: string };

export interface CapasConsultadas {
  capas: CapaRow[];
  total: number;
}

/**
 * Consulta permisos, conteo y página en una sola sentencia.
 *
 * Propietario y colaboradores activos pueden consultar.
 * Devuelve null cuando el proyecto no está disponible.
 * Incluye capas ocultas o en procesamiento para su gestión en la interfaz.
 */
@Injectable()
export class CapasConsultaRepository {
  constructor(private readonly database: DatabaseService) {}

  /** pagina y limite deben haber sido validados por el DTO. */
  async listarDisponibles(
    idProyecto: string,
    idUsuario: string,
    pagina: number,
    limite: number,
  ): Promise<CapasConsultadas | null> {
    const resultado = await this.database.query<FilaConsulta>(
      `
        WITH disponible AS (
          SELECT proyecto.id_proyecto
          FROM obra.proyectos AS proyecto
          JOIN obra.usuarios AS propietario
            ON propietario.id_usuario = proyecto.id_propietario
          JOIN obra.usuarios AS solicitante
            ON solicitante.id_usuario = $2::uuid
          WHERE proyecto.id_proyecto = $1::uuid
            AND proyecto.activo = TRUE
            AND propietario.estado = 'ACTIVO'
            AND solicitante.estado = 'ACTIVO'
            AND (
              proyecto.id_propietario = solicitante.id_usuario
              OR EXISTS (
                SELECT 1
                FROM obra.usuario_proyecto AS colaboracion
                WHERE colaboracion.id_proyecto = proyecto.id_proyecto
                  AND colaboracion.id_usuario = solicitante.id_usuario
              )
            )
        ),
        filtradas AS (
          SELECT capa.*
          FROM obra.capas AS capa
          JOIN disponible
            ON disponible.id_proyecto = capa.id_proyecto
        ),
        conteo AS (
          SELECT COUNT(*)::text AS total FROM filtradas
        ),
        seleccion AS (
          SELECT *
          FROM filtradas
          ORDER BY orden ASC, id_capa ASC
          LIMIT $3::integer
          OFFSET $4::bigint
        )
        SELECT seleccion.*, conteo.total
        FROM disponible
        CROSS JOIN conteo
        LEFT JOIN seleccion ON TRUE
        ORDER BY seleccion.orden ASC, seleccion.id_capa ASC
      `,
      [idProyecto, idUsuario, limite, (pagina - 1) * limite],
    );

    const primera = resultado.rows[0];

    if (!primera) return null;

    const total = Number(primera.total);

    if (
      typeof primera.total !== 'string'
      || primera.total.trim() !== primera.total
      || !/^\d+$/.test(primera.total)
      || !Number.isSafeInteger(total)
      || total < 0
    ) {
      throw new Error('El conteo de capas tiene un formato inesperado.');
    }

    const capas: CapaRow[] = [];

    for (const fila of resultado.rows) {
      if (fila.id_capa === null) continue;

      const { total: totalFila, ...capa } = fila;
      capas.push(capa);
    }

    // Estos registros son internos. El servicio debe aplicar mapearCapa.
    return { capas, total };
  }
}