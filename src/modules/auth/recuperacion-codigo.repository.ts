import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import {
  coincidenHashesRecuperacion,
  DURACION_RECUPERACION_SEGUNDOS,
  MAX_INTENTOS_RECUPERACION,
  protegerCodigoRecuperacion,
} from './utils/codigo-recuperacion';
/**
import {
  DURACION_RECUPERACION_SEGUNDOS,
} from './utils/token-recuperacion';
*/
interface CuentaLocal {
  id_usuario: string;
  correo: string;
  version_sesion: number;
}

/**
 * Emite y consume códigos de recuperación.
 *
 * Cada método debe ejecutarse dentro de withTransaction.
 * Siempre bloquea primero la cuenta y después su solicitud.
 */
@Injectable()
export class RecuperacionCodigoRepository {
  private async bloquearCuenta(
    client: PoolClient,
    correo: string,
  ): Promise<CuentaLocal | null> {
    const resultado = await client.query<CuentaLocal>(
      `
        SELECT id_usuario, correo, version_sesion
        FROM obra.usuarios
        WHERE lower(correo) = lower($1::text)
          AND estado = 'ACTIVO'
          AND password_hash IS NOT NULL
        FOR UPDATE
      `,
      [correo],
    );

    return resultado.rows[0] ?? null;
  }

  async emitir(
    client: PoolClient,
    correo: string,
    codigo: string,
    secreto: Buffer,
  ): Promise<string | null> {
    const cuenta = await this.bloquearCuenta(client, correo);

    if (cuenta === null) return null;

    /*
 * La cuenta ya está bloqueada: las emisiones simultáneas se serializan.
 *
 * El contador es independiente de la solicitud y sobrevive a su consumo.
 * Si el límite rechaza la emisión, conservamos el código vigente.
 *
 * La respuesta pública seguirá siendo genérica.
 */
    const permiso = await client.query(
      `
    WITH reloj AS (
      SELECT clock_timestamp() AS ahora
    )
    INSERT INTO obra.recuperacion_limites AS limite (
      id_usuario, inicio_ventana, ultima_emision, emisiones
    )
    SELECT $1, ahora, ahora, 1
    FROM reloj
    ON CONFLICT (id_usuario) DO UPDATE
    SET inicio_ventana = CASE
          WHEN limite.inicio_ventana <=
               EXCLUDED.ultima_emision - interval '1 hour'
          THEN EXCLUDED.ultima_emision
          ELSE limite.inicio_ventana
        END,
        emisiones = CASE
          WHEN limite.inicio_ventana <=
               EXCLUDED.ultima_emision - interval '1 hour'
          THEN 1
          ELSE limite.emisiones + 1
        END,
        ultima_emision = EXCLUDED.ultima_emision
    WHERE limite.ultima_emision <=
          EXCLUDED.ultima_emision - interval '60 seconds'
      AND (
        limite.inicio_ventana <=
          EXCLUDED.ultima_emision - interval '1 hour'
        OR limite.emisiones < 5
      )
    RETURNING id_usuario
  `,
      [cuenta.id_usuario],
    );

    if (permiso.rowCount === 0) {
      return null;
    }

    if (permiso.rowCount !== 1) {
      throw new Error('No se pudo comprobar el límite de recuperación.');
    }

    const hash = protegerCodigoRecuperacion(
      cuenta.id_usuario,
      codigo,
      secreto,
    );

    await client.query(
      `
        INSERT INTO obra.recuperaciones_password (
          id_usuario, token_hash, version_sesion,
          fecha_creacion, fecha_expiracion, intentos_fallidos
        )
        VALUES (
          $1, $2, $3,
          statement_timestamp(),
          statement_timestamp() + ($4::integer * interval '1 second'),
          0
        )
        ON CONFLICT (id_usuario) DO UPDATE
        SET token_hash = EXCLUDED.token_hash,
            version_sesion = EXCLUDED.version_sesion,
            fecha_creacion = EXCLUDED.fecha_creacion,
            fecha_expiracion = EXCLUDED.fecha_expiracion,
            intentos_fallidos = 0
      `,
      [
        cuenta.id_usuario,
        hash,
        cuenta.version_sesion,
        DURACION_RECUPERACION_SEGUNDOS,
      ],
    );

    return cuenta.correo;
  }

  /**
   * Devuelve false ante un código incorrecto o no disponible.
   *
   * IMPORTANTE: el servicio debe permitir que la transacción confirme
   * este false y lanzar el error HTTP después. De lo contrario,
   * se revertiría el incremento de intentos.
   */
  async consumir(
    client: PoolClient,
    correo: string,
    codigo: string,
    nuevoPasswordHash: string,
    secreto: Buffer,
  ): Promise<boolean> {
    const cuenta = await this.bloquearCuenta(client, correo);

    if (cuenta === null) return false;

    const resultado = await client.query<{ token_hash: string }>(
      `
        SELECT token_hash
        FROM obra.recuperaciones_password
        WHERE id_usuario = $1
          AND version_sesion = $2
          AND fecha_expiracion > clock_timestamp()
          AND intentos_fallidos < $3
        FOR UPDATE
      `,
      [
        cuenta.id_usuario,
        cuenta.version_sesion,
        MAX_INTENTOS_RECUPERACION,
      ],
    );

    const solicitud = resultado.rows[0];

    if (!solicitud) return false;

    const calculado = protegerCodigoRecuperacion(
      cuenta.id_usuario,
      codigo,
      secreto,
    );

    if (!coincidenHashesRecuperacion(calculado, solicitud.token_hash)) {
      await client.query(
        `
          UPDATE obra.recuperaciones_password
          SET intentos_fallidos = intentos_fallidos + 1
          WHERE id_usuario = $1
        `,
        [cuenta.id_usuario],
      );

      return false;
    }

    /*
     * Se vuelve a comprobar el vencimiento antes de consumir.
     * La cuenta y la solicitud permanecen bloqueadas.
     */
    const eliminacion = await client.query(
      `
        DELETE FROM obra.recuperaciones_password
        WHERE id_usuario = $1
          AND fecha_expiracion > clock_timestamp()
        RETURNING id_usuario
      `,
      [cuenta.id_usuario],
    );

    if (eliminacion.rowCount === 0) return false;

    if (eliminacion.rowCount !== 1) {
      throw new Error('No se pudo comprobar el consumo del código.');
    }

    const actualizacion = await client.query(
      `
        UPDATE obra.usuarios
        SET password_hash = $2,
            version_sesion = version_sesion + 1
        WHERE id_usuario = $1
          AND estado = 'ACTIVO'
          AND password_hash IS NOT NULL
          AND version_sesion = $3
      `,
      [
        cuenta.id_usuario,
        nuevoPasswordHash,
        cuenta.version_sesion,
      ],
    );

    if (actualizacion.rowCount !== 1) {
      throw new Error('No se pudo restablecer la contraseña.');
    }

    return true;
  }
}