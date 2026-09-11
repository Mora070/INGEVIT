import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

import type { Express } from 'express';
import type {} from 'multer';

/**
 * Extrae el contenido del archivo recibido mediante Multer.
 *
 * Responsabilidades:
 * - Rechazar peticiones sin fotografía.
 * - Rechazar archivos sin contenido disponible en memoria.
 * - Entregar el Buffer al servicio de subida.
 *
 * No comprueba permisos ni interpreta la imagen.
 * Esas validaciones pertenecen al servicio y al procesamiento
 * de fotografías.
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

    // Conservamos los bytes originales sin copiarlos ni modificarlos.
    return archivo.buffer;
  }
}