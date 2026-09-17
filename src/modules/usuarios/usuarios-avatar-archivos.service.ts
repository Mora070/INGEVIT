import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

import {
  AlmacenamientoService,
} from '../almacenamiento/almacenamiento.service';

/**
 * Guarda el resultado de optimizarAvatar.
 *
 * No recibe el archivo original ni actualiza PostgreSQL.
 * El coordinador debe entregar únicamente el WebP ya procesado.
 */
@Injectable()
export class UsuariosAvatarArchivosService {
  constructor(
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  /**
   * Guarda un archivo nuevo y devuelve su clave interna.
   *
   * No utiliza nombres proporcionados por el usuario.
   * La implementación de almacenamiento debe impedir sobrescrituras.
   */
  async guardarOptimizado(contenido: Buffer): Promise<string> {
    if (!Buffer.isBuffer(contenido) || contenido.length === 0) {
      throw new Error(
        'El contenido optimizado del avatar debe ser un Buffer no vacío.',
      );
    }

    const clave = `avatares/${randomUUID()}.webp`;
    const entrada = Readable.from([contenido]);

    try {
      await this.almacenamiento.guardar(clave, entrada);
      return clave;
    } finally {
      /*
       * Libera el flujo tanto al finalizar como ante un fallo.
       *
       * No eliminamos la clave si guardar falla: una colisión podría
       * haber rechazado la escritura sobre un archivo preexistente.
       */
      entrada.destroy();
    }
  }
}