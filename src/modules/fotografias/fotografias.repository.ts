import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import type {
  CrearFotografiaInput,
} from './types/crear-fotografia.types';

import type {
  FotografiaRow,
} from './types/fotografia.types';

/**
 * Escribe los metadatos de fotografías.
 *
 * Recibe el cliente de la transacción administrada por el servicio.
 * No abre conexiones, confirma transacciones ni manipula archivos.
 */
@Injectable()
export class FotografiasRepository {
  /**
   * Registra las referencias del original y de la versión optimizada.
   *
   * El servicio debe haber comprobado la autorización y completado
   * el almacenamiento de ambas versiones antes de llamar este método.
   *
   * PostgreSQL genera el identificador y la fecha de subida.
   * Los errores de integridad se propagan al servicio.
   */
  async crear(
    client: PoolClient,
    datos: CrearFotografiaInput,
  ): Promise<FotografiaRow> {
    const resultado = await client.query<FotografiaRow>(
      `
        INSERT INTO obra.fotografias (
          id_proyecto,
          id_usuario_subida,
          titulo,
          url,
          s3_key,
          original_s3_key
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3,
          $4,
          $5,
          $6
        )
        RETURNING
          id_fotografia,
          id_proyecto,
          id_usuario_subida,
          titulo,
          url,
          s3_key,
          original_s3_key,
          fecha_subida
      `,
      [
        datos.idProyecto,
        datos.idUsuarioSubida,
        datos.titulo,
        datos.url,
        datos.s3Key,
        datos.originalS3Key,
      ],
    );

    const fotografia = resultado.rows[0];

    if (resultado.rowCount !== 1 || !fotografia) {
      throw new Error(
        'La inserción de la fotografía no devolvió el registro esperado.',
      );
    }

    return fotografia;
  }
}