import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  PipeTransform,
} from '@nestjs/common';

import type { Express } from 'express';
import type {} from 'multer';

import {
  MAX_BYTES_FOTOGRAFIA_ORIGINAL,
} from '../config/procesamiento-fotografia.config';

/**
 * Comprueba el contenido recibido y lo entrega al servicio.
 *
 * El interceptor limita la recepción del archivo.
 * Este pipe verifica explícitamente el tamaño del Buffer
 * antes de permitir que se ejecute el servicio de subida.
 *
 * El formato real de la imagen se valida durante su procesamiento.
 */
@Injectable()
export class ContenidoFotografiaPipe
  implements PipeTransform<Express.Multer.File | undefined, Buffer>
{
  transform(archivo: Express.Multer.File | undefined): Buffer {
    if (
      !archivo ||
      !Buffer.isBuffer(archivo.buffer) ||
      archivo.buffer.length === 0
    ) {
      throw new BadRequestException(
        'Debes proporcionar un archivo de fotografía no vacío.',
      );
    }

    // Exactamente 20 MiB está permitido; cualquier byte adicional no.
    if (archivo.buffer.length > MAX_BYTES_FOTOGRAFIA_ORIGINAL) {
      throw new PayloadTooLargeException(
        'La fotografía no puede superar 20 MiB.',
      );
    }

    return archivo.buffer;
  }
}