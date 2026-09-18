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

  /**
   * Actualiza el título de una fotografía del proyecto indicado.
   *
   * El servicio debe comprobar previamente la autorización usando
   * la misma transacción.
   *
   * La condición incluye el proyecto para impedir que una fotografía
   * de otro proyecto se modifique mediante esta operación.
   *
   * No cambia el autor, la fecha de subida ni las referencias
   * de almacenamiento.
   *
   * Devuelve null cuando no existe una fotografía coincidente.
   */
  async actualizarTitulo(
    client: PoolClient,
    idProyecto: string,
    idFotografia: string,
    titulo: string,
  ): Promise<FotografiaRow | null> {
    const resultado = await client.query<FotografiaRow>(
      `
      UPDATE obra.fotografias
      SET titulo = $3
      WHERE id_proyecto = $1::uuid
        AND id_fotografia = $2::uuid
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
      [idProyecto, idFotografia, titulo],
    );

    if (resultado.rowCount === 0) {
      return null;
    }

    const fotografia = resultado.rows[0];

    if (resultado.rowCount !== 1 || !fotografia) {
      throw new Error(
        'La actualización de la fotografía no devolvió el registro esperado.',
      );
    }

    return fotografia;
  }

  /**
 * Elimina una fotografía del proyecto indicado y devuelve
 * los metadatos del registro eliminado.
 *
 * Contrato para el servicio que llama:
 * - Comprobar previamente la autorización.
 * - Registrar ambas claves en la cola de eliminación usando
 *   este mismo client y antes de confirmar la transacción.
 * - Registrar la actividad correspondiente en esa transacción.
 *
 * No elimina archivos físicos.
 *
 * Devuelve null si la fotografía no pertenece al proyecto
 * indicado o si ya no existe.
 */
  async eliminar(
    client: PoolClient,
    idProyecto: string,
    idFotografia: string,
  ): Promise<FotografiaRow | null> {
    const resultado = await client.query<FotografiaRow>(
      `
      DELETE FROM obra.fotografias
      WHERE id_proyecto = $1::uuid
        AND id_fotografia = $2::uuid
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
      [idProyecto, idFotografia],
    );

    if (resultado.rowCount === 0) {
      return null;
    }

    const fotografia = resultado.rows[0];

    if (resultado.rowCount !== 1 || !fotografia) {
      throw new Error(
        'La eliminación de la fotografía no devolvió el registro esperado.',
      );
    }

    return fotografia;
  }

}