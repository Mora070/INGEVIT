import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  PipeTransform,
} from '@nestjs/common';

import type { Express } from 'express';
import type {} from 'multer';

import { MAX_BYTES_PLANO } from '../config/subida-plano.config';

/**
 * Comprueba la presencia y el tamaño del archivo recibido.
 *
 * No confía en el tamaño declarado por el cliente:
 * utiliza la longitud real del Buffer.
 *
 * La interpretación y validación del PDF pertenecen al servicio.
 */
@Injectable()
export class ContenidoPlanoPipe
  implements PipeTransform<Express.Multer.File | undefined, Buffer>
{
  transform(archivo: Express.Multer.File | undefined): Buffer {
    if (
      !archivo ||
      !Buffer.isBuffer(archivo.buffer) ||
      archivo.buffer.length === 0
    ) {
      throw new BadRequestException(
        'Debes proporcionar un archivo de plano no vacío.',
      );
    }

    if (archivo.buffer.length > MAX_BYTES_PLANO) {
      throw new PayloadTooLargeException(
        'El plano no puede superar 35 MiB.',
      );
    }

    // Entrega los bytes originales sin modificarlos ni duplicarlos.
    return archivo.buffer;
  }
}