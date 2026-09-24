import { Injectable } from '@nestjs/common';
import type { PoolClient, QueryResult } from 'pg';

import { VIGENCIA_CAPA_SEGUNDOS } from './utils/vigencia-capa';
import type { CapaRow } from './types/capa.types';
import type {
  PublicacionTeselas,
} from './utils/publicar-teselas-locales';

/**
 * Transiciones condicionadas por estado e identificador de intento.
 *
 * Antes de iniciar o finalizar, el coordinador debe comprobar
 * y bloquear al propietario y al proyecto.
 *
 * marcarError permite cerrar técnicamente un intento propio aunque
 * haya cambiado el acceso. Su condición por token impide modificar
 * un intento posterior.
 *
 * Las transacciones son cortas: GDAL se ejecuta fuera de ellas.
 */
@Injectable()
export class CapasProcesamientoRepository {
  async iniciar(
    client: PoolClient,
    idProyecto: string,
    idCapa: string,
  ): Promise<CapaRow | null> {
    const resultado = await client.query<CapaRow>(
      `
        UPDATE obra.capas
        SET estado_procesamiento = 'PROCESANDO',
            procesamiento_token = gen_random_uuid(),
            procesamiento_inicio = clock_timestamp(),
            procesamiento_vence = clock_timestamp() + $3::integer * INTERVAL '1 second',
            error_procesamiento = NULL,
            fecha_actualizacion = clock_timestamp()
        WHERE id_proyecto = $1::uuid
          AND id_capa = $2::uuid
          AND estado_procesamiento = 'PENDIENTE'
          AND teselas_version IS NULL
        RETURNING *
      `,
      [idProyecto, idCapa, VIGENCIA_CAPA_SEGUNDOS],
    );

    return this.fila(resultado);
  }

  async finalizar(
    client: PoolClient,
    idProyecto: string,
    idCapa: string,
    token: string,
    publicacion: PublicacionTeselas,
  ): Promise<CapaRow | null> {
    // Adquiere primero el bloqueo: evalúa la vigencia DESPUÉS de cualquier espera.
    await this.bloquearIntento(client, idProyecto, idCapa, token);
    const resultado = await client.query<CapaRow>(
      `
        UPDATE obra.capas
        SET estado_procesamiento = 'LISTA',
            teselas_version = $4::uuid,
            teselas_proveedor = $5,
            teselas_zoom_min = $6::integer,
            teselas_zoom_max = $7::integer,
            teselas_tamano = $8::integer,
            teselas_total = $9::bigint,
            procesamiento_token = NULL,
            procesamiento_inicio = NULL,
            procesamiento_vence = NULL,
            error_procesamiento = NULL,
            fecha_actualizacion = clock_timestamp()
        WHERE id_proyecto = $1::uuid
          AND id_capa = $2::uuid
          AND estado_procesamiento = 'PROCESANDO'
          AND procesamiento_token = $3::uuid
          AND procesamiento_vence > clock_timestamp()
        RETURNING *
      `,
      [
        idProyecto,
        idCapa,
        token,
        publicacion.version,
        publicacion.proveedor,
        publicacion.zoomMin,
        publicacion.zoomMax,
        publicacion.tamano,
        publicacion.total,
      ],
    );

    return this.fila(resultado);
  }

  async marcarError(
    client: PoolClient,
    idProyecto: string,
    idCapa: string,
    token: string,
  ): Promise<CapaRow | null> {
    const resultado = await client.query<CapaRow>(
      `
        UPDATE obra.capas
        SET estado_procesamiento = 'ERROR',
            error_procesamiento = 'No fue posible completar el procesamiento de la capa.',
            procesamiento_token = NULL,
            procesamiento_inicio = NULL,
            procesamiento_vence = NULL,
            fecha_actualizacion = clock_timestamp()
        WHERE id_proyecto = $1::uuid
          AND id_capa = $2::uuid
          AND estado_procesamiento = 'PROCESANDO'
          AND procesamiento_token = $3::uuid
        RETURNING *
      `,
      [idProyecto, idCapa, token],
    );

    return this.fila(resultado);
  }


  /** Solo renueva un token todavía vigente; nunca resucita un permiso vencido. */
  async renovar(client: PoolClient, proyecto: string, capa: string, token: string): Promise<boolean> {
    await this.bloquearIntento(client, proyecto, capa, token);
    const resultado = await client.query(
      `UPDATE obra.capas
       SET procesamiento_vence = clock_timestamp() + $4::integer * INTERVAL '1 second'
       WHERE id_proyecto = $1::uuid AND id_capa = $2::uuid
         AND estado_procesamiento = 'PROCESANDO' AND procesamiento_token = $3::uuid
         AND procesamiento_vence > clock_timestamp()
       RETURNING id_capa`,
      [proyecto, capa, token, VIGENCIA_CAPA_SEGUNDOS],
    );
    return resultado.rowCount === 1;
  }

  /**
   * El filtro opcional limita la operación a un proyecto (útil en pruebas).
   * Sin él, el trabajador atiende un lote global. No modifica LISTA.
   * SKIP LOCKED evita competir con una finalización que ya posee el bloqueo.
   */
  async recuperarVencidos(client: PoolClient, limite = 20, proyecto: string | null = null): Promise<string[]> {
    if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
      throw new Error('El lote de recuperación debe estar entre 1 y 100.');
    }
    const resultado = await client.query<{ id_capa: string }>(
      `WITH vencidas AS (
         SELECT id_capa, procesamiento_token
         FROM obra.capas
         WHERE estado_procesamiento = 'PROCESANDO'
           AND procesamiento_vence <= clock_timestamp()
           AND ($2::uuid IS NULL OR id_proyecto = $2::uuid)
         ORDER BY procesamiento_vence, id_capa
         LIMIT $1::integer
         FOR UPDATE SKIP LOCKED
       )
       UPDATE obra.capas AS c
       SET estado_procesamiento = 'ERROR',
           error_procesamiento = 'El intento perdió su vigencia. Puede solicitar un reintento.',
           procesamiento_token = NULL, procesamiento_inicio = NULL,
           procesamiento_vence = NULL, fecha_actualizacion = clock_timestamp()
       FROM vencidas AS v
       WHERE c.id_capa = v.id_capa AND c.procesamiento_token = v.procesamiento_token
         AND c.estado_procesamiento = 'PROCESANDO'
         AND c.procesamiento_vence <= clock_timestamp()
       RETURNING c.id_capa`,
      [limite, proyecto],
    );
    return resultado.rows.map(fila => fila.id_capa);
  }

  private async bloquearIntento(client: PoolClient, proyecto: string, capa: string, token: string): Promise<void> {
    await client.query(
      `SELECT id_capa FROM obra.capas
       WHERE id_proyecto = $1::uuid AND id_capa = $2::uuid
         AND procesamiento_token = $3::uuid
       FOR UPDATE`,
      [proyecto, capa, token],
    );
  }

  private fila(resultado: QueryResult<CapaRow>): CapaRow | null {
    if (resultado.rowCount === 0 && resultado.rows.length === 0) {
      return null;
    }

    if (
      resultado.rowCount !== 1
      || resultado.rows.length !== 1
      || !resultado.rows[0]
    ) {
      throw new Error(
        'La transición de procesamiento devolvió un resultado inesperado.',
      );
    }

    return resultado.rows[0];
  }
}

