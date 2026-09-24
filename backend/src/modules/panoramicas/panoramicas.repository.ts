import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import type {
  MimePanoramica,
  PanoramicaRow,
} from './types/panoramica.types';

/**
 * Datos internos para registrar una panorámica.
 *
 * El servicio obtiene el usuario de la sesión y determina la clave,
 * URL y MIME después de validar y almacenar el archivo.
 */
export interface CrearPanoramicaInput {
  id_proyecto: string;
  id_usuario_subida: string;
  titulo: string;
  url: string;
  s3_key: string;
  mime_type: MimePanoramica;
    /** Ubicación WGS84 seleccionada manualmente y validada por el DTO. */
  latitud: number;
  longitud: number;
}

/**
 * Ejecuta escrituras dentro de la transacción del servicio.
 * No comprueba permisos ni accede al almacenamiento físico.
 */
@Injectable()
export class PanoramicasRepository {
  async crear(
    client: PoolClient,
    datos: CrearPanoramicaInput,
  ): Promise<PanoramicaRow> {
    const resultado = await client.query<PanoramicaRow>(
      `
        INSERT INTO obra.panoramicas (
          id_proyecto,
          id_usuario_subida,
          titulo,
          url,
          s3_key,
          mime_type,
          latitud,
          longitud
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8::numeric)
        RETURNING
          id_panoramica,
          id_proyecto,
          id_usuario_subida,
          titulo,
          url,
          s3_key,
          mime_type,
          latitud,
          longitud,
          fecha_subida
      `,
      [
        datos.id_proyecto,
        datos.id_usuario_subida,
        datos.titulo,
        datos.url,
        datos.s3_key,
        datos.mime_type,
        datos.latitud,
        datos.longitud
      ],
    );

    const panoramica = resultado.rows[0];

    if (
      resultado.rowCount !== 1 ||
      resultado.rows.length !== 1 ||
      !panoramica
    ) {
      throw new Error(
        'La creación de la panorámica no devolvió exactamente un registro.',
      );
    }

    return panoramica;
  }


  /**
   * Actualiza solo el título de una panorámica del proyecto indicado.
   * El servicio debe comprobar el acceso en la misma transacción.
   */
  async actualizarTitulo(
    client: PoolClient,
    idProyecto: string,
    idPanoramica: string,
    titulo: string,
  ): Promise<PanoramicaRow | null> {
    const resultado = await client.query<PanoramicaRow>(
      `
        UPDATE obra.panoramicas
        SET titulo = $3
        WHERE id_proyecto = $1
          AND id_panoramica = $2
        RETURNING
          id_panoramica, id_proyecto, id_usuario_subida,
          titulo, url, s3_key, mime_type, latitud, longitud, fecha_subida
      `,
      [idProyecto, idPanoramica, titulo],
    );

    if (resultado.rowCount === 0 && resultado.rows.length === 0) {
      return null;
    }

    const panoramica = resultado.rows[0];

    if (
      resultado.rowCount !== 1 ||
      resultado.rows.length !== 1 ||
      !panoramica
    ) {
      throw new Error(
        'La actualización de la panorámica devolvió un resultado inesperado.',
      );
    }

    return panoramica;
  }

  /**
 * Elimina una panorámica del proyecto indicado y devuelve su registro.
 *
 * El servicio debe comprobar el acceso y encolar el archivo dentro
 * de la misma transacción. Este método no modifica el almacenamiento.
 */
  async eliminar(
    client: PoolClient,
    idProyecto: string,
    idPanoramica: string,
  ): Promise<PanoramicaRow | null> {
    const resultado = await client.query<PanoramicaRow>(
      `
        DELETE FROM obra.panoramicas
        WHERE id_proyecto = $1
          AND id_panoramica = $2
        RETURNING
          id_panoramica, id_proyecto, id_usuario_subida,
          titulo, url, s3_key, mime_type, latitud, longitud, fecha_subida
      `,
      [idProyecto, idPanoramica],
    );

    if (resultado.rowCount === 0 && resultado.rows.length === 0) {
      return null;
    }

    const panoramica = resultado.rows[0];

    if (
      resultado.rowCount !== 1 ||
      resultado.rows.length !== 1 ||
      !panoramica
    ) {
      throw new Error(
        'La eliminación de la panorámica devolvió un resultado inesperado.',
      );
    }

    return panoramica;
  }

}