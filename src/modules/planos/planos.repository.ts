import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import type { PlanoRow } from './types/plano.types';

/**
 * Datos internos necesarios para registrar un PDF.
 *
 * El servicio coordinador establece el proyecto, el usuario autenticado,
 * la URL y la clave del archivo. No deben copiarse directamente del
 * cuerpo enviado por el cliente.
 */
export interface CrearPlanoInput {
  id_proyecto: string;
  id_usuario_subida: string;
  titulo: string;
  descripcion: string;
  url: string;
  s3_key: string;
}

/**
 * Campos permitidos en la edición descriptiva.
 * No contiene identificadores ni información del archivo.
 */
export interface ActualizarPlanoInput {
  titulo: string;
  descripcion: string;
}

/**
 * Ejecuta las escrituras de planos.
 *
 * No almacena archivos ni comprueba permisos.
 * Utiliza la conexión recibida para participar en la misma transacción
 * que las comprobaciones de acceso y el registro de actividades.
 */
@Injectable()
export class PlanosRepository {
  /**
   * Inserta un plano y devuelve el registro generado por PostgreSQL.
   *
   * El identificador y la fecha utilizan los valores predeterminados
   * de la tabla. El tipo de contenido se establece en el backend.
   *
   * Los errores de PostgreSQL se propagan para que el coordinador
   * pueda revertir la transacción.
   */
  async crear(
    client: PoolClient,
    datos: CrearPlanoInput,
  ): Promise<PlanoRow> {
    const resultado = await client.query<PlanoRow>(
      `
        INSERT INTO obra.planos (
          id_proyecto,
          id_usuario_subida,
          titulo,
          descripcion,
          url,
          s3_key,
          mime_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'application/pdf')
        RETURNING
          id_plano,
          id_proyecto,
          id_usuario_subida,
          titulo,
          descripcion,
          url,
          s3_key,
          mime_type,
          fecha_subida
      `,
      [
        datos.id_proyecto,
        datos.id_usuario_subida,
        datos.titulo,
        datos.descripcion,
        datos.url,
        datos.s3_key,
      ],
    );

    const plano = resultado.rows[0];

    // Una inserción individual debe devolver exactamente un registro.
    if (
      resultado.rowCount !== 1 ||
      resultado.rows.length !== 1 ||
      !plano
    ) {
      throw new Error(
        'La creación del plano no devolvió exactamente un registro.',
      );
    }

    return plano;
  }

  /**
 * Actualiza exclusivamente los datos descriptivos.
 *
 * El coordinador debe comprobar el acceso dentro de la misma
 * transacción antes de llamar a este método.
 *
 * Ambos identificadores participan en el WHERE para impedir
 * modificar un plano perteneciente a otro proyecto.
 *
 * Devuelve null si el plano no existe en el proyecto indicado.
 */
  async actualizarDatos(
    client: PoolClient,
    idProyecto: string,
    idPlano: string,
    datos: ActualizarPlanoInput,
  ): Promise<PlanoRow | null> {
    const resultado = await client.query<PlanoRow>(
      `
        UPDATE obra.planos
        SET
          titulo = $3,
          descripcion = $4
        WHERE id_proyecto = $1
          AND id_plano = $2
        RETURNING
          id_plano,
          id_proyecto,
          id_usuario_subida,
          titulo,
          descripcion,
          url,
          s3_key,
          mime_type,
          fecha_subida
      `,
      [
        idProyecto,
        idPlano,
        datos.titulo,
        datos.descripcion,
      ],
    );

    if (resultado.rowCount === 0 && resultado.rows.length === 0) {
      return null;
    }

    const plano = resultado.rows[0];

    if (
      resultado.rowCount !== 1 ||
      resultado.rows.length !== 1 ||
      !plano
    ) {
      throw new Error(
        'La actualización del plano devolvió un resultado inesperado.',
      );
    }

    return plano;
  }

  /**
 * Elimina un plano perteneciente al proyecto indicado.
 *
 * PostgreSQL elimina sus incidencias mediante ON DELETE CASCADE.
 * Devuelve el registro eliminado para programar el borrado del PDF.
 *
 * El coordinador debe comprobar el acceso y registrar la tarea
 * de eliminación y la actividad dentro de esta misma transacción.
 *
 * No elimina archivos directamente.
 */
  async eliminar(
    client: PoolClient,
    idProyecto: string,
    idPlano: string,
  ): Promise<PlanoRow | null> {
    const resultado = await client.query<PlanoRow>(
      `
        DELETE FROM obra.planos
        WHERE id_proyecto = $1
          AND id_plano = $2
        RETURNING
          id_plano,
          id_proyecto,
          id_usuario_subida,
          titulo,
          descripcion,
          url,
          s3_key,
          mime_type,
          fecha_subida
      `,
      [idProyecto, idPlano],
    );

    if (resultado.rowCount === 0 && resultado.rows.length === 0) {
      return null;
    }

    const plano = resultado.rows[0];

    if (
      resultado.rowCount !== 1 ||
      resultado.rows.length !== 1 ||
      !plano
    ) {
      throw new Error(
        'La eliminación del plano devolvió un resultado inesperado.',
      );
    }

    return plano;
  }
}