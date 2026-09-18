import { Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';

import {
  AlmacenamientoService,
} from '../almacenamiento/almacenamiento.service';

import {
  generarClavesFotografia,
} from './utils/generar-claves-fotografia';

import type {
  ClavesFotografia,
} from './utils/generar-claves-fotografia';

import type {
  FotografiaProcesada,
} from './types/fotografia-procesada.types';

/**
 * Coordina el almacenamiento de las dos versiones de una fotografía.
 *
 * No procesa imágenes, comprueba permisos ni modifica PostgreSQL.
 * Recibe el resultado del procesamiento previamente validado.
 */
@Injectable()
export class FotografiasArchivosService {
  constructor(
    private readonly almacenamiento: AlmacenamientoService,
  ) { }

  /**
   * Guarda ambas versiones y devuelve sus claves internas.
   *
   * Solo comunica éxito después de completar las dos escrituras.
   * Si falla la segunda, intenta compensar eliminando el original
   * que esta operación guardó correctamente.
   */
  async guardarVersiones(
    fotografia: FotografiaProcesada,
  ): Promise<ClavesFotografia> {
    const claves = generarClavesFotografia(
      fotografia.formatoOriginal,
    );

    /*
     * Esta escritura queda fuera del bloque de compensación.
     * Si falla, no eliminamos su clave: podría existir previamente
     * y haber sido rechazada por la creación exclusiva.
     */
    await this.guardarBuffer(
      claves.original_s3_key,
      fotografia.original,
    );

    try {
      await this.guardarBuffer(
        claves.s3_key,
        fotografia.optimizada,
      );
    } catch (errorEscritura: unknown) {
      try {
        // Solo eliminamos el original que acabamos de guardar.
        await this.almacenamiento.eliminar(
          claves.original_s3_key,
        );
      } catch (errorLimpieza: unknown) {
        throw new AggregateError(
          [errorEscritura, errorLimpieza],
          'Falló el guardado de la versión optimizada y no pudo eliminarse el original.',
        );
      }

      throw errorEscritura;
    }

    return claves;
  }

  /**
   * Adapta un Buffer al contrato de almacenamiento basado en flujos.
   *
   * El finally también cubre fallos anteriores al inicio de pipeline,
   * como el rechazo de una clave ya existente.
   */

  /**
 * Elimina ambas versiones previamente guardadas.
 *
 * Debe recibir claves internas cuya pertenencia a la operación
 * o fotografía haya sido comprobada por el servicio coordinador.
 *
 * Intenta ambas eliminaciones aunque alguna falle.
 * El almacenamiento admite reintentos cuando un archivo ya no existe.
 *
 * No debe utilizarse para compensar una transacción cuyo resultado
 * de COMMIT sea desconocido: podría borrar archivos ya referenciados.
 */
  async eliminarVersiones(
    claves: ClavesFotografia,
  ): Promise<void> {
    const resultados = await Promise.allSettled(
      [
        claves.original_s3_key,
        claves.s3_key,
      ].map(async (clave) => {
        await this.almacenamiento.eliminar(clave);
      }),
    );

    const errores: unknown[] = [];

    for (const resultado of resultados) {
      if (resultado.status === 'rejected') {
        errores.push(resultado.reason);
      }
    }

    if (errores.length > 0) {
      throw new AggregateError(
        errores,
        'No se pudieron eliminar todas las versiones de la fotografía.',
      );
    }
  }


  private async guardarBuffer(
    clave: string,
    contenido: Buffer,
  ): Promise<void> {
    const entrada = Readable.from([contenido]);

    try {
      await this.almacenamiento.guardar(clave, entrada);
    } finally {
      entrada.destroy();
    }
  }
}