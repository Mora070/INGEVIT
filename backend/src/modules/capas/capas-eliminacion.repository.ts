import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

export interface CapaParaEliminar {
  id_capa: string;
  original_key: string;
  almacenamiento_proveedor: string;
  estado_procesamiento: string;
  teselas_version: string | null;
  teselas_proveedor: string | null;
}

export interface LimpiezaCapa {
  id_capa: string;
  original_key: string;
  teselas_version: string | null;
}

/**
 * Coordina registros de eliminación dentro de transacciones.
 * No accede al disco ni confirma transacciones.
 */
@Injectable()
export class CapasEliminacionRepository {
  async bloquear(
    client: PoolClient,
    proyecto: string,
    capa: string,
  ): Promise<CapaParaEliminar | null> {
    const resultado = await client.query<CapaParaEliminar>(
      `
        SELECT id_capa, original_key, almacenamiento_proveedor,
               estado_procesamiento, teselas_version, teselas_proveedor
        FROM obra.capas
        WHERE id_proyecto = $1::uuid AND id_capa = $2::uuid
        FOR UPDATE
      `,
      [proyecto, capa],
    );

    return resultado.rows[0] ?? null;
  }

  async registrar(
    client: PoolClient,
    capa: CapaParaEliminar,
  ): Promise<void> {
    await client.query(
      `
        INSERT INTO obra.capas_pendientes_eliminacion (
          id_capa, original_key, teselas_version
        )
        VALUES ($1::uuid, $2, $3::uuid)
      `,
      [capa.id_capa, capa.original_key, capa.teselas_version],
    );
  }

  async eliminar(
    client: PoolClient,
    proyecto: string,
    capa: string,
  ): Promise<void> {
    const resultado = await client.query(
      `
        DELETE FROM obra.capas
        WHERE id_proyecto = $1::uuid AND id_capa = $2::uuid
      `,
      [proyecto, capa],
    );

    if (resultado.rowCount !== 1) {
      throw new Error('No se eliminó la capa bloqueada.');
    }
  }

  /**
   * El filtro opcional permite probar una tarea concreta sin procesar
   * tareas ajenas. El trabajador normal no proporciona ese filtro.
   */
  async bloquearTarea(
    client: PoolClient,
    idCapa: string | null = null,
  ): Promise<LimpiezaCapa | null> {
    const resultado = await client.query<LimpiezaCapa>(
      `
        SELECT id_capa, original_key, teselas_version
        FROM obra.capas_pendientes_eliminacion
        WHERE fecha_proximo_intento <= clock_timestamp()
          AND ($1::uuid IS NULL OR id_capa = $1::uuid)
        ORDER BY fecha_proximo_intento, fecha_creacion, id_capa
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `,
      [idCapa],
    );

    return resultado.rows[0] ?? null;
  }

  async conservaReferencias(
    client: PoolClient,
    tarea: LimpiezaCapa,
  ): Promise<boolean> {
    const resultado = await client.query<{ referenciado: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM obra.capas
          WHERE id_capa = $1::uuid
             OR (
               almacenamiento_proveedor = 'LOCAL'
               AND original_key = $2
             )
        ) AS referenciado
      `,
      [tarea.id_capa, tarea.original_key],
    );

    const fila = resultado.rows[0];

    if (
      resultado.rowCount !== 1
      || !fila
      || typeof fila.referenciado !== 'boolean'
    ) {
      throw new Error('No se pudieron comprobar las referencias.');
    }

    return fila.referenciado;
  }

  async completar(client: PoolClient, capa: string): Promise<void> {
    const resultado = await client.query(
      `
        DELETE FROM obra.capas_pendientes_eliminacion
        WHERE id_capa = $1::uuid
      `,
      [capa],
    );

    if (resultado.rowCount !== 1) {
      throw new Error('No se encontró la tarea de limpieza bloqueada.');
    }
  }

  async aplazar(client: PoolClient, capa: string): Promise<void> {
    await client.query(
      `
        UPDATE obra.capas_pendientes_eliminacion
        SET fecha_proximo_intento = GREATEST(
          fecha_proximo_intento,
          clock_timestamp() + INTERVAL '30 seconds'
        )
        WHERE id_capa = $1::uuid
      `,
      [capa],
    );
  }
}