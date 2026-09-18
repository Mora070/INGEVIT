import { Injectable } from '@nestjs/common';

import {
  ResultadoTransaccionDesconocidoError,
} from '../../database/errors/resultado-transaccion-desconocido.error';

import {
  AlmacenamientoService,
} from '../almacenamiento/almacenamiento.service';

import {
  UsuariosAvatarArchivosService,
} from './usuarios-avatar-archivos.service';

/**
 * Coordina la escritura del avatar y su registro transaccional.
 *
 * Recibe únicamente el WebP producido por optimizarAvatar.
 * No mantiene una transacción abierta durante la escritura del archivo.
 */
@Injectable()
export class UsuariosAvatarPersistenciaService {
  constructor(
    private readonly archivos: UsuariosAvatarArchivosService,
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  /**
   * Guarda el archivo y espera la confirmación de su referencia.
   *
   * Contrato de registrar:
   * - Debe utilizar UsuariosAvatarService.cambiarReferencia.
   * - Debe esperar a que termine su transacción.
   * - No debe ejecutar operaciones adicionales después de confirmarla.
   * - Debe propagar ResultadoTransaccionDesconocidoError sin modificarlo.
   *
   * La clave se genera internamente, nunca procede de la petición HTTP.
   */
  async guardarYRegistrar(
    optimizado: Buffer,
    registrar: (clave: string) => Promise<void>,
  ): Promise<void> {
    /*
     * Fuera del bloque de compensación: si guardar falla,
     * no sabemos que esta operación sea propietaria del archivo.
     */
    const clave = await this.archivos.guardarOptimizado(optimizado);

    try {
      await registrar(clave);
    } catch (errorRegistro: unknown) {
      /*
       * PostgreSQL podría haber confirmado la referencia.
       * Eliminar el archivo aquí podría dejar un avatar roto.
       *
       * Conservamos el archivo y propagamos la incertidumbre.
       * No reintentamos automáticamente el registro.
       */
      if (
        errorRegistro instanceof ResultadoTransaccionDesconocidoError
      ) {
        throw errorRegistro;
      }

      /*
       * La operación no llegó a registrar el avatar o su transacción
       * se revirtió correctamente. Compensamos exclusivamente
       * el archivo nuevo que acabamos de guardar.
       */
      try {
        await this.almacenamiento.eliminar(clave);
      } catch (errorLimpieza: unknown) {
        throw new AggregateError(
          [errorRegistro, errorLimpieza],
          'Falló el registro del avatar y no pudo eliminarse el archivo nuevo.',
        );
      }

      throw errorRegistro;
    }
  }
}