import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import {
    validarClaveAlmacenamiento,
} from './utils/validar-clave-almacenamiento';

/**
 * Tarea persistente de eliminación de un archivo.
 */
export interface ArchivoPendienteRow {
    s3_key: string;
    fecha_creacion: Date;
}

/**
 * Registra tareas persistentes de eliminación de archivos.
 *
 * Recibe la conexión de una transacción administrada por el servicio.
 * No confirma transacciones ni accede al almacenamiento.
 */
@Injectable()
export class ArchivosPendientesRepository {
    /**
     * Registra las claves cuyo borrado debe completarse después
     * de confirmar la transacción.
     *
     * Contrato para el servicio que llama:
     * - Obtener las claves de registros internos, nunca del cliente HTTP.
     * - Retirar las referencias correspondientes en la misma transacción.
     * - No registrar archivos que deban continuar disponibles.
     *
     * Una clave ya pendiente no genera otra tarea ni modifica
     * su fecha de creación.
     */
    async registrar(
        client: PoolClient,
        claves: readonly string[],
    ): Promise<void> {
        if (claves.length === 0) {
            return;
        }

        /*
         * Validamos todas las claves antes de ejecutar el INSERT.
         * Reutilizamos el formato admitido por el almacenamiento.
         *
         * Esta validación comprueba el formato, no demuestra que
         * el archivo haya dejado de estar referenciado.
         */
        const clavesValidadas = claves.map(
            (clave) => validarClaveAlmacenamiento(clave),
        );

        await client.query(
            `
        INSERT INTO obra.archivos_pendientes_eliminacion (
          s3_key
        )
        SELECT clave
        FROM unnest($1::text[]) AS pendientes(clave)
        ON CONFLICT (s3_key) DO NOTHING
      `,
            [clavesValidadas],
        );
    }


    /**
   * Selecciona y bloquea la primera tarea disponible.
   *
   * Debe ejecutarse dentro de una transacción.
   * El bloqueo se conserva hasta confirmar o revertir esa transacción.
   *
   * SKIP LOCKED permite omitir tareas reservadas por otros trabajadores.
   * null significa que no hay tareas disponibles en ese momento;
   * pueden existir tareas bloqueadas por otras transacciones.
   */
    async bloquearSiguiente(
        client: PoolClient,
    ): Promise<ArchivoPendienteRow | null> {
        const resultado = await client.query<ArchivoPendienteRow>(
            `
      SELECT s3_key, fecha_creacion
      FROM obra.archivos_pendientes_eliminacion
      ORDER BY fecha_creacion, s3_key
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `,
        );

        return resultado.rows[0] ?? null;
    }

    /**
     * Retira una tarea después de completar el borrado físico.
     *
     * El llamante debe haber bloqueado esta tarea mediante
     * bloquearSiguiente y utilizar la misma transacción.
     *
     * No llamar antes de eliminar el archivo.
     */
    async completar(
        client: PoolClient,
        clave: string,
    ): Promise<void> {
        const claveValidada = validarClaveAlmacenamiento(clave);

        const resultado = await client.query(
            `
      DELETE FROM obra.archivos_pendientes_eliminacion
      WHERE s3_key = $1
    `,
            [claveValidada],
        );

        if (resultado.rowCount !== 1) {
            throw new Error(
                'No se encontró la tarea de eliminación que debía completarse.',
            );
        }
    }
}