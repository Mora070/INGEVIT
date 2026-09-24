import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

export interface CapaParaReintento {
  id_capa: string;
  estado_procesamiento: string;
  almacenamiento_proveedor: string;
  teselas_version: string | null;
  procesamiento_token: string | null;
}

/** Se utiliza dentro de la transacción y después de bloquear usuario y proyecto. */
@Injectable()
export class CapasReintentoRepository {
  async bloquear(client: PoolClient, proyecto: string, capa: string): Promise<CapaParaReintento | null> {
    const resultado = await client.query<CapaParaReintento>(
      `SELECT id_capa, estado_procesamiento, almacenamiento_proveedor,
              teselas_version, procesamiento_token
       FROM obra.capas
       WHERE id_proyecto = $1::uuid AND id_capa = $2::uuid
       FOR UPDATE`,
      [proyecto, capa],
    );
    return resultado.rows[0] ?? null;
  }

  async encolar(client: PoolClient, proyecto: string, capa: string): Promise<boolean> {
    const resultado = await client.query(
      `UPDATE obra.capas
       SET estado_procesamiento = 'PENDIENTE',
           error_procesamiento = NULL,
           procesamiento_token = NULL,
           procesamiento_inicio = NULL,
           fecha_actualizacion = clock_timestamp()
       WHERE id_proyecto = $1::uuid AND id_capa = $2::uuid
         AND estado_procesamiento = 'ERROR'
         AND almacenamiento_proveedor = 'LOCAL'
         AND teselas_version IS NULL
         AND procesamiento_token IS NULL
       RETURNING id_capa`,
      [proyecto, capa],
    );
    return resultado.rowCount === 1;
  }
}
