import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

/**
 * Referencia interna del avatar.
 *
 * La clave identifica el archivo en almacenamiento.
 * No debe recibirse directamente desde el cuerpo de una petición HTTP.
 */
export interface ReferenciaAvatar {
  foto_perfil_url: string | null;
  foto_perfil_key: string | null;
}

export interface NuevoAvatar {
  url: string;
  clave: string;
}

/**
 * Acceso transaccional a la fotografía de perfil.
 *
 * Todos los métodos reciben la conexión de la transacción.
 * No abren conexiones, confirman cambios ni eliminan archivos.
 */
@Injectable()
export class UsuariosAvatarRepository {
  /**
   * Bloquea una cuenta activa y obtiene su referencia actual.
   *
   * El bloqueo permanece hasta finalizar la transacción.
   * Dos cambios sobre la misma cuenta se ejecutan secuencialmente.
   *
   * null significa que la cuenta no existe o está inactiva.
   * Una cuenta sin avatar devuelve un objeto con ambos campos null.
   */
  async bloquearCuentaActiva(
    client: PoolClient,
    idUsuario: string,
  ): Promise<ReferenciaAvatar | null> {
    const resultado = await client.query<ReferenciaAvatar>(
      `
        SELECT foto_perfil_url, foto_perfil_key
        FROM obra.usuarios
        WHERE id_usuario = $1::uuid
          AND estado = 'ACTIVO'
        FOR UPDATE
      `,
      [idUsuario],
    );

    return resultado.rows[0] ?? null;
  }

  /**
   * Actualiza conjuntamente URL y clave, o retira ambas.
   *
   * El servicio debe bloquear primero la cuenta mediante
   * bloquearCuentaActiva y utilizar esta misma conexión.
   *
   * Cada nuevo archivo debe tener una clave recién generada:
   * no se reutilizan claves antiguas ni pendientes de eliminación.
   */
  async actualizarReferencia(
    client: PoolClient,
    idUsuario: string,
    avatar: NuevoAvatar | null,
  ): Promise<void> {
    const resultado = await client.query(
      `
        UPDATE obra.usuarios
        SET foto_perfil_url = $2,
            foto_perfil_key = $3
        WHERE id_usuario = $1::uuid
          AND estado = 'ACTIVO'
      `,
      [
        idUsuario,
        avatar?.url ?? null,
        avatar?.clave ?? null,
      ],
    );

    if (resultado.rowCount !== 1) {
      throw new Error(
        'No se pudo actualizar la referencia del avatar de la cuenta bloqueada.',
      );
    }
  }
}