import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../database/database.service';
import {
  ResultadoTransaccionDesconocidoError,
} from '../../database/errors/resultado-transaccion-desconocido.error';
import {
  AlmacenamientoService,
} from '../almacenamiento/almacenamiento.service';

/**
 * Coordina el almacenamiento del PDF y su registro transaccional.
 *
 * Antes de llamar a este servicio, el coordinador debe:
 * - Comprobar el acceso del usuario.
 * - Inspeccionar el PDF y validar su tamaño.
 *
 * La función registrar debe volver a comprobar el acceso dentro
 * de la transacción, insertar el plano y registrar su actividad.
 */
@Injectable()
export class PlanosPersistenciaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  /**
   * Guarda los bytes originales bajo una clave generada internamente.
   *
   * registrar utiliza exclusivamente la conexión recibida:
   * no debe confirmar la transacción ni realizar efectos externos.
   *
   * Devuelve el resultado únicamente después de confirmar PostgreSQL.
   */
  async guardarYRegistrar<T>(
    contenido: Buffer,
    registrar: (
      client: PoolClient,
      clave: string,
    ) => Promise<T>,
  ): Promise<T> {
    const clave = `planos/${randomUUID()}.pdf`;
    const entrada = Readable.from([contenido]);

    /*
     * La escritura ocurre antes de abrir la transacción.
     *
     * Si falla, no eliminamos la clave: el almacenamiento podría
     * haber rechazado un archivo ya existente. Su implementación
     * se encarga de limpiar las escrituras parciales propias.
     */
    try {
      await this.almacenamiento.guardar(clave, entrada);
    } finally {
      entrada.destroy();
    }

    try {
      return await this.database.withTransaction(
        async (client) => registrar(client, clave),
      );
    } catch (errorRegistro: unknown) {
      /*
       * Un resultado incierto podría significar que el plano
       * quedó registrado. Eliminar su archivo rompería la referencia.
       */
      if (
        errorRegistro instanceof ResultadoTransaccionDesconocidoError
      ) {
        throw errorRegistro;
      }

      /*
       * DatabaseService garantiza para los demás errores que
       * el registro no empezó o que la reversión fue confirmada.
       * Podemos compensar el archivo guardado por esta operación.
       */
      try {
        await this.almacenamiento.eliminar(clave);
      } catch (errorLimpieza: unknown) {
        throw new AggregateError(
          [errorRegistro, errorLimpieza],
          'Falló el registro del plano y no pudo eliminarse su archivo.',
        );
      }

      throw errorRegistro;
    }
  }
}