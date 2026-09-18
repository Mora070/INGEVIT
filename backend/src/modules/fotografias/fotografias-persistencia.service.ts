import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../database/database.service';

import {
  ResultadoTransaccionDesconocidoError,
} from '../../database/errors/resultado-transaccion-desconocido.error';

import {
  FotografiasArchivosService,
} from './fotografias-archivos.service';

import type {
  FotografiaProcesada,
} from './types/fotografia-procesada.types';

import type {
  ClavesFotografia,
} from './utils/generar-claves-fotografia';

/**
 * Coordina archivos y una transacción de registro.
 *
 * El procesamiento de la imagen debe haberse completado previamente.
 * La operación recibida debe comprobar el acceso transaccional,
 * insertar los metadatos y registrar la actividad.
 *
 * No implementa reintentos automáticos.
 */
@Injectable()
export class FotografiasPersistenciaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly archivos: FotografiasArchivosService,
  ) {}

  /**
   * Guarda ambas versiones y ejecuta su registro en PostgreSQL.
   *
   * El resultado solo se devuelve después de confirmar la transacción.
   *
   * La operación recibida no debe administrar la transacción ni
   * producir efectos externos: debe utilizar exclusivamente el client
   * para sus consultas y propagar cualquier error.
   */
  async guardarYRegistrar<T>(
    fotografia: FotografiaProcesada,
    registrar: (
      client: PoolClient,
      claves: ClavesFotografia,
    ) => Promise<T>,
  ): Promise<T> {
    /*
     * No mantenemos una transacción abierta durante la escritura.
     * guardarVersiones gestiona sus propios fallos parciales.
     */
    const claves = await this.archivos.guardarVersiones(fotografia);

    try {
      return await this.database.withTransaction(
        async (client) => registrar(client, claves),
      );
    } catch (errorRegistro: unknown) {
      /*
       * No borramos archivos si PostgreSQL podría haber confirmado
       * los metadatos o si no se pudo confirmar la reversión.
       */
      if (
        errorRegistro instanceof ResultadoTransaccionDesconocidoError
      ) {
        throw errorRegistro;
      }

      /*
       * Según el contrato de DatabaseService:
       * - La transacción fue revertida correctamente, o
       * - Falló su preparación antes de ejecutar el registro.
       *
       * Las dos versiones fueron guardadas por esta operación,
       * por lo que podemos intentar compensarlas.
       */
      try {
        await this.archivos.eliminarVersiones(claves);
      } catch (errorLimpieza: unknown) {
        throw new AggregateError(
          [errorRegistro, errorLimpieza],
          'Falló el registro de la fotografía y no pudieron eliminarse todas sus versiones.',
        );
      }

      throw errorRegistro;
    }
  }
}