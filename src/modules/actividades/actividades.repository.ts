import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import type { CrearActividadInput } from './types/crear-actividad.types';

/**
 * Registra el historial de acciones de los proyectos.
 *
 * Las escrituras utilizan una conexión proporcionada por el servicio
 * que coordina la operación de negocio.
 *
 * No crea otro pool ni administra la transacción.
 */
@Injectable()
export class ActividadesRepository {
  /**
   * Inserta una actividad dentro de la transacción del llamador.
   *
   * Si la inserción falla, el error se propaga para que
   * DatabaseService.withTransaction() revierta la operación completa.
   */
  async crear(
    client: PoolClient,
    datos: CrearActividadInput,
  ): Promise<void> {
    const result = await client.query(
      `
        INSERT INTO obra.actividades (
          id_proyecto,
          id_actor,
          tipo_accion,
          mensaje
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3,
          $4
        )
      `,
      [
        datos.idProyecto,
        datos.idActor,
        datos.tipoAccion,
        datos.mensaje,
      ],
    );

    /**
     * Una inserción individual debe registrar exactamente una fila.
     * Un resultado diferente impide confirmar la operación sin historial.
     */
    if (result.rowCount !== 1) {
      throw new Error(
        'No se pudo registrar la actividad del proyecto.',
      );
    }
  }
}