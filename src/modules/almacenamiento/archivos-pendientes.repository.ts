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
     * Selecciona y bloquea una tarea cuyo próximo intento ya esté disponible.
     *
     * Debe ejecutarse dentro de una transacción.
     * SKIP LOCKED omite tareas reservadas por otros trabajadores.
     *
     * null puede significar que la cola está vacía, que las tareas
     * están bloqueadas o que todavía no llegó su próximo intento.
     */
    async bloquearSiguiente(
        client: PoolClient,
    ): Promise<ArchivoPendienteRow | null> {
        const resultado = await client.query<ArchivoPendienteRow>(
            `
      SELECT s3_key, fecha_creacion
      FROM obra.archivos_pendientes_eliminacion
      WHERE fecha_proximo_intento <= statement_timestamp()
      ORDER BY fecha_proximo_intento, fecha_creacion, s3_key
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


    /**
 * Comprueba si alguna fotografía conserva una referencia a la clave.
 *
 * Incluye originales y versiones optimizadas de todos los proyectos,
 * aunque el proyecto o su propietario estén inactivos.
 *
 * La inactividad no significa que el archivo pueda borrarse.
 *
 * Esta comprobación cubre fotografías. El trabajador deberá limitarse
 * a esa categoría hasta implementar las comprobaciones equivalentes
 * para planos y panorámicas.
 */
    async estaReferenciadoEnFotografias(
        client: PoolClient,
        clave: string,
    ): Promise<boolean> {
        const claveValidada = validarClaveAlmacenamiento(clave);

        const resultado = await client.query<{
            referenciado: boolean;
        }>(
            `
      SELECT EXISTS (
        SELECT 1
        FROM obra.fotografias
        WHERE s3_key = $1
           OR original_s3_key = $1
      ) AS referenciado
    `,
            [claveValidada],
        );

        const fila = resultado.rows[0];

        /*
         * Un resultado inesperado no debe interpretarse como permiso
         * para borrar. Detenemos la operación.
         */
        if (
            resultado.rowCount !== 1 ||
            !fila ||
            typeof fila.referenciado !== 'boolean'
        ) {
            throw new Error(
                'No se pudo comprobar si el archivo continúa referenciado.',
            );
        }

        return fila.referenciado;
    }


    /**
 * Aplaza una tarea después de un fallo.
 *
 * Debe ejecutarse en una transacción nueva si la transacción
 * de procesamiento anterior fue revertida.
 *
 * Devuelve false si la tarea ya no existe. Otro trabajador
 * podría haberla completado después de liberarse el bloqueo.
 *
 * No modifica la clave ni la fecha original de creación.
 */
    async aplazar(
        client: PoolClient,
        clave: string,
        demoraSegundos: number,
    ): Promise<boolean> {
        const claveValidada = validarClaveAlmacenamiento(clave);

        if (
            !Number.isSafeInteger(demoraSegundos) ||
            demoraSegundos <= 0
        ) {
            throw new Error(
                'La demora del reintento debe ser un número entero positivo de segundos.',
            );
        }

        const resultado = await client.query(
            `
      UPDATE obra.archivos_pendientes_eliminacion
      SET fecha_proximo_intento = GREATEST(
        fecha_proximo_intento,
        statement_timestamp()
          + ($2::double precision * INTERVAL '1 second')
      )
      WHERE s3_key = $1
    `,
            [claveValidada, demoraSegundos],
        );

        if (resultado.rowCount === 0) {
            return false;
        }

        if (resultado.rowCount !== 1) {
            throw new Error(
                'No se pudo determinar el resultado del aplazamiento de la tarea.',
            );
        }

        return true;
    }

    /**
 * Comprueba referencias de planos de todos los proyectos.
 *
 * No filtra por actividad del proyecto ni por estado del usuario:
 * esas condiciones no autorizan a eliminar un archivo conservado.
 * 
 * 
 *  * Esta comprobación cubre originales y versiones optimizadas.
 * El trabajador selecciona la comprobación según la categoría.
 */
    async estaReferenciadoEnPlanos(
        client: PoolClient,
        clave: string,
    ): Promise<boolean> {
        const claveValidada = validarClaveAlmacenamiento(clave);

        const resultado = await client.query<{
            referenciado: boolean;
        }>(
            `
        SELECT EXISTS (
          SELECT 1
          FROM obra.planos
          WHERE s3_key = $1
        ) AS referenciado
      `,
            [claveValidada],
        );

        const fila = resultado.rows[0];

        if (
            resultado.rowCount !== 1 ||
            resultado.rows.length !== 1 ||
            !fila ||
            typeof fila.referenciado !== 'boolean'
        ) {
            throw new Error(
                'No se pudo comprobar si el archivo continúa referenciado.',
            );
        }

        return fila.referenciado;
    }

    /**
 * Comprueba referencias de panorámicas en todos los proyectos.
 * La inactividad del proyecto o del usuario no permite borrar el archivo.
 */
    async estaReferenciadoEnPanoramicas(
        client: PoolClient,
        clave: string,
    ): Promise<boolean> {
        const claveValidada = validarClaveAlmacenamiento(clave);

        const resultado = await client.query<{
            referenciado: boolean;
        }>(
            `
        SELECT EXISTS (
          SELECT 1
          FROM obra.panoramicas
          WHERE s3_key = $1
        ) AS referenciado
      `,
            [claveValidada],
        );

        const fila = resultado.rows[0];

        if (
            resultado.rowCount !== 1 ||
            resultado.rows.length !== 1 ||
            !fila ||
            typeof fila.referenciado !== 'boolean'
        ) {
            throw new Error(
                'No se pudo comprobar si el archivo continúa referenciado.',
            );
        }

        return fila.referenciado;
    }
}

