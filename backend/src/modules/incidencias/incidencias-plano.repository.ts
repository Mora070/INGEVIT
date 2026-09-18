import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

/**
 * Consulta el plano necesario para crear una incidencia.
 *
 * El servicio debe comprobar primero el acceso al proyecto.
 * Este repositorio no concede permisos por sí mismo.
 */
@Injectable()
export class IncidenciasPlanoRepository {
  /**
   * Devuelve el número de páginas y mantiene un bloqueo compartido
   * sobre el plano hasta finalizar la transacción.
   *
   * FOR SHARE impide su eliminación o modificación concurrente,
   * pero permite que otras transacciones consulten el mismo plano.
   *
   * Orden de uso:
   * 1. Comprobar y bloquear el acceso al proyecto.
   * 2. Obtener este bloqueo sobre el plano.
   * 3. Validar la página e insertar la incidencia.
   *
   * Devuelve null si el plano no pertenece al proyecto indicado.
   */
  async bloquearDisponible(
    client: PoolClient,
    idProyecto: string,
    idPlano: string,
  ): Promise<number | null> {
    const resultado = await client.query<{
      numero_paginas: number;
    }>(
      `
        SELECT numero_paginas
        FROM obra.planos
        WHERE id_proyecto = $1
          AND id_plano = $2
        FOR SHARE
      `,
      [idProyecto, idPlano],
    );

    if (resultado.rowCount === 0 && resultado.rows.length === 0) {
      return null;
    }

    const fila = resultado.rows[0];

    /*
     * Un metadato inesperado no debe interpretarse como un plano
     * disponible ni sustituirse por una cantidad inventada.
     */
    if (
      resultado.rowCount !== 1 ||
      resultado.rows.length !== 1 ||
      !fila ||
      !Number.isSafeInteger(fila.numero_paginas) ||
      fila.numero_paginas < 1 ||
      fila.numero_paginas > 2147483647
    ) {
      throw new Error(
        'No se pudo determinar el número de páginas del plano.',
      );
    }

    return fila.numero_paginas;
  }
}