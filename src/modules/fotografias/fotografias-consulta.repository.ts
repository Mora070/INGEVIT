import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

import type { FotografiaRow } from './types/fotografia.types';

import type {
  FotografiaPaginaConsultaRow,
  ResultadoConsultaFotografias,
} from './types/fotografias-paginadas-row.types';

/**
 * Consulta metadatos de fotografías sin modificar registros ni archivos.
 *
 * La disponibilidad se comprueba dentro de la misma sentencia que
 * obtiene la página solicitada y el total de fotografías.
 */
@Injectable()
export class FotografiasConsultaRepository {
  constructor(
    private readonly database: DatabaseService,
  ) {}

  /**
   * Obtiene fotografías de un proyecto disponible para el solicitante.
   *
   * Precondición: pagina y limite ya fueron validados por el DTO.
   *
   * @returns null si el proyecto no está disponible; en otro caso,
   * devuelve las fotografías de la página y el total del proyecto.
   */
  async findDisponiblesPaginadas(
    idProyecto: string,
    idUsuario: string,
    pagina: number,
    limite: number,
  ): Promise<ResultadoConsultaFotografias> {
    const desplazamiento = (pagina - 1) * limite;

    const resultado =
      await this.database.query<FotografiaPaginaConsultaRow>(
        `
          WITH proyecto_disponible AS (
            SELECT p.id_proyecto
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
                  FROM obra.usuario_proyecto AS relacion
                  WHERE relacion.id_proyecto = p.id_proyecto
                    AND relacion.id_usuario = solicitante.id_usuario
                )
              )
          ),
          conteo AS (
            SELECT (
              SELECT COUNT(*)::text
              FROM obra.fotografias AS fotografia
              WHERE fotografia.id_proyecto = proyecto.id_proyecto
            ) AS total
            FROM proyecto_disponible AS proyecto
          ),
          pagina_seleccionada AS (
            SELECT
              fotografia.id_fotografia,
              fotografia.id_proyecto,
              fotografia.id_usuario_subida,
              fotografia.titulo,
              fotografia.url,
              fotografia.s3_key,
              fotografia.fecha_subida
            FROM obra.fotografias AS fotografia
            INNER JOIN proyecto_disponible AS proyecto
              ON proyecto.id_proyecto = fotografia.id_proyecto
            ORDER BY
              fotografia.fecha_subida DESC,
              fotografia.id_fotografia DESC
            LIMIT $3::integer
            OFFSET $4::bigint
          )
          SELECT
            pagina.id_fotografia,
            pagina.id_proyecto,
            pagina.id_usuario_subida,
            pagina.titulo,
            pagina.url,
            pagina.s3_key,
            pagina.fecha_subida,
            conteo.total
          FROM conteo
          LEFT JOIN pagina_seleccionada AS pagina ON true
          ORDER BY
            pagina.fecha_subida DESC,
            pagina.id_fotografia DESC
        `,
        [idProyecto, idUsuario, limite, desplazamiento],
      );

    const primeraFila = resultado.rows[0];

    // Sin proyecto disponible, el conteo tampoco produce una fila.
    if (!primeraFila) {
      return null;
    }

    const totalTexto = primeraFila.total;

    if (
      typeof totalTexto !== 'string'
      || !/^\d+$/.test(totalTexto)
    ) {
      throw new Error(
        'El conteo de fotografías tiene un formato inesperado.',
      );
    }

    const total = Number(totalTexto);

    if (!Number.isSafeInteger(total) || total < 0) {
      throw new Error(
        'El total de fotografías no puede representarse correctamente.',
      );
    }

    const fotografias: FotografiaRow[] = [];

    for (const fila of resultado.rows) {
      // El LEFT JOIN permite conservar el total con una página vacía.
      if (fila.id_fotografia === null) {
        continue;
      }

      fotografias.push({
        id_fotografia: fila.id_fotografia,
        id_proyecto: fila.id_proyecto,
        id_usuario_subida: fila.id_usuario_subida,
        titulo: fila.titulo,
        url: fila.url,
        s3_key: fila.s3_key,
        fecha_subida: fila.fecha_subida,
      });
    }

    return {
      fotografias,
      total,
    };
  }
}