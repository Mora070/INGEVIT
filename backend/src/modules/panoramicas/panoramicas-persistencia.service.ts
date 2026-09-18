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
 * Coordina el archivo original y su registro en PostgreSQL.
 *
 * El coordinador debe inspeccionar el archivo y comprobar el acceso
 * antes de llamar a este servicio.
 *
 * registrar debe volver a comprobar el acceso, insertar la panorámica
 * y registrar su actividad utilizando exclusivamente el client recibido.
 */
@Injectable()
export class PanoramicasPersistenciaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  async guardarYRegistrar<T>(
    contenido: Buffer,
    formato: 'jpeg' | 'png' | 'webp',
    registrar: (
      client: PoolClient,
      clave: string,
    ) => Promise<T>,
  ): Promise<T> {
    // Protección para llamadas internas que no respeten el tipo TypeScript.
    if (
      formato !== 'jpeg' &&
      formato !== 'png' &&
      formato !== 'webp'
    ) {
      throw new Error('El formato interno de la panorámica no es válido.');
    }

    const clave = `panoramicas/${randomUUID()}.${formato}`;
    const entrada = Readable.from([contenido]);

    /*
     * No mantenemos una transacción abierta durante la escritura.
     *
     * Si guardar falla, no eliminamos la clave: podría haber rechazado
     * un archivo existente. El almacenamiento limpia sus escrituras
     * parciales según su propio contrato.
     */
    try {
      await this.almacenamiento.guardar(clave, entrada);
    } finally {
      entrada.destroy();
    }

    try {
      return await this.database.withTransaction(
        (client) => registrar(client, clave),
      );
    } catch (errorRegistro: unknown) {
      /*
       * No eliminamos el archivo si la transacción pudo confirmarse
       * o si no se pudo confirmar su reversión.
       */
      if (
        errorRegistro instanceof ResultadoTransaccionDesconocidoError
      ) {
        throw errorRegistro;
      }

      try {
        await this.almacenamiento.eliminar(clave);
      } catch (errorLimpieza: unknown) {
        throw new AggregateError(
          [errorRegistro, errorLimpieza],
          'Falló el registro de la panorámica y no pudo eliminarse su archivo.',
        );
      }

      throw errorRegistro;
    }
  }
}