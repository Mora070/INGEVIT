import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { crearTemporalCapa } from './crear-temporal-capa';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface TemporalCapa {
  ruta: string;
  tamanoBytes: number;
}

/**
 * Recibe un archivo mediante un flujo y lo mantiene temporalmente en disco.
 *
 * - Cuenta los bytes reales, sin confiar en Content-Length.
 * - No acumula el archivo completo en memoria.
 * - Genera una carpeta exclusiva y un nombre interno.
 * - Elimina el temporal al terminar, también cuando ocurre un error.
 *
 * La operación debe esperar todas sus lecturas antes de finalizar.
 * No debe devolver la ruta para utilizarla posteriormente.
 *
 * Esta función no valida todavía el formato TIFF ni su georreferenciación.
 * La raíz temporal es configuración interna; nunca procede del cliente.
 */
export async function recibirTemporalCapa<T>(
  contenido: Readable,
  maxArchivoBytes: number,
  operacion: (archivo: TemporalCapa) => Promise<T>,
  raizTemporal?: string,
): Promise<T> {
  if (
    !Number.isSafeInteger(maxArchivoBytes)
    || maxArchivoBytes <= 0
    || maxArchivoBytes >= Number.MAX_SAFE_INTEGER
  ) {
    throw new Error('El límite temporal de la capa no es válido.');
  }

  const directorio = await crearTemporalCapa(
    'original',
    raizTemporal,
  );

  try {
    const ruta = join(directorio, 'original.bin');
    let tamanoBytes = 0;

    const limitar = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        /*
         * Comparamos antes de sumar para evitar desbordamientos.
         * El fragmento que excede el límite no se escribe en disco.
         */
        if (chunk.length > maxArchivoBytes - tamanoBytes) {
          callback(
            new PayloadTooLargeException(
              'El GeoTIFF supera el tamaño máximo configurado.',
            ),
          );
          return;
        }

        tamanoBytes += chunk.length;
        callback(null, chunk);
      },
    });

    await pipeline(
      contenido,
      limitar,
      createWriteStream(ruta, {
        flags: 'wx',
        mode: 0o600,
      }),
    );

    if (tamanoBytes === 0) {
      throw new BadRequestException(
        'El archivo de la capa está vacío.',
      );
    }

    // El await mantiene el temporal disponible durante toda la operación.
    return await operacion({ ruta, tamanoBytes });
  } finally {
    await rm(directorio, {
      recursive: true,
      force: true,
    });
  }
}