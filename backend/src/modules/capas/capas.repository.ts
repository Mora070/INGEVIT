import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import type { CapaRow } from './types/capa.types';

export interface ConfiguracionCapaInput {
  opacidad: number;
  visible: boolean;
  orden: number;
}

/**
 * Datos internos preparados por el servicio de subida.
 * No corresponde al cuerpo recibido del cliente.
 */
export interface CrearCapaInput {
  idProyecto: string;
  idUsuarioSubida: string;
  nombre: string;
  descripcion: string;
  nombreArchivoOriginal: string;
  originalKey: string;
  tamanoOriginalBytes: number;
  crsOriginal: string;
  bbox: readonly [number, number, number, number];
}

/** Escrituras ejecutadas con el cliente de la transacción del servicio. */
@Injectable()
export class CapasRepository {
  /**
   * Modifica exclusivamente la presentación de una capa del proyecto.
   * El servicio debe haber comprobado y bloqueado el acceso del propietario.
   */
  async actualizarConfiguracion(
    client: PoolClient,
    idProyecto: string,
    idCapa: string,
    datos: ConfiguracionCapaInput,
  ): Promise<CapaRow | null> {
    const resultado = await client.query<CapaRow>(
      `
        UPDATE obra.capas
        SET opacidad = $3::numeric,
            visible = $4::boolean,
            orden = $5::integer,
            fecha_actualizacion = clock_timestamp()
        WHERE id_proyecto = $1::uuid
          AND id_capa = $2::uuid
        RETURNING *
      `,
      [
        idProyecto,
        idCapa,
        datos.opacidad,
        datos.visible,
        datos.orden,
      ],
    );

    if (resultado.rowCount === 0 && resultado.rows.length === 0) {
      return null;
    }

    const capa = resultado.rows[0];

    if (
      resultado.rowCount !== 1
      || resultado.rows.length !== 1
      || !capa
    ) {
      throw new Error(
        'La actualización de la capa devolvió un resultado inesperado.',
      );
    }

    return capa;
  }

  /**
 * Registra el original local después de inspeccionarlo.
 *
 * El servicio debe haber comprobado y bloqueado al propietario
 * y al proyecto dentro de esta misma transacción.
 *
 * La capa comienza PENDIENTE. Todavía no tiene teselas publicadas.
 * No abre transacciones ni guarda archivos.
 */
  async crearPendiente(
    client: PoolClient,
    datos: CrearCapaInput,
  ): Promise<CapaRow> {
    const resultado = await client.query<CapaRow>(
      `
        INSERT INTO obra.capas (
          id_proyecto,
          id_usuario_subida,
          nombre,
          descripcion,
          nombre_archivo_original,
          almacenamiento_proveedor,
          original_key,
          tamano_original_bytes,
          crs_original,
          bbox_oeste,
          bbox_sur,
          bbox_este,
          bbox_norte,
          estado_procesamiento
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3,
          $4,
          $5,
          'LOCAL',
          $6,
          $7::bigint,
          $8,
          $9::numeric,
          $10::numeric,
          $11::numeric,
          $12::numeric,
          'PENDIENTE'
        )
        RETURNING *
      `,
      [
        datos.idProyecto,
        datos.idUsuarioSubida,
        datos.nombre,
        datos.descripcion,
        datos.nombreArchivoOriginal,
        datos.originalKey,
        datos.tamanoOriginalBytes,
        datos.crsOriginal,
        datos.bbox[0],
        datos.bbox[1],
        datos.bbox[2],
        datos.bbox[3],
      ],
    );

    const capa = resultado.rows[0];

    if (
      resultado.rowCount !== 1
      || resultado.rows.length !== 1
      || !capa
    ) {
      throw new Error(
        'La creación de la capa devolvió un resultado inesperado.',
      );
    }

    return capa;
  }
}