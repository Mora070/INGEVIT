import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  PipeTransform,
} from '@nestjs/common';

import type { Express } from 'express';
import type {} from 'multer';

import {
  MAX_BYTES_PANORAMICA,
} from '../config/subida-panoramica.config';

/**
 * Comprueba presencia y tamaño antes de inspeccionar la imagen.
 *
 * No confía en el nombre, MIME ni tamaño declarados por el cliente.
 * La interpretación del contenido corresponde al inspector.
 */
@Injectable()
export class ContenidoPanoramicaPipe
  implements PipeTransform<Express.Multer.File | undefined, Buffer>
{
  transform(archivo: Express.Multer.File | undefined): Buffer {
    if (
      !archivo ||
      !Buffer.isBuffer(archivo.buffer) ||
      archivo.buffer.length === 0
    ) {
      throw new BadRequestException(
        'Debes proporcionar una imagen panorámica no vacía.',
      );
    }

    if (archivo.buffer.length > MAX_BYTES_PANORAMICA) {
      throw new PayloadTooLargeException(
        'La panorámica no puede superar 50 MB.',
      );
    }

    return archivo.buffer;
  }
}