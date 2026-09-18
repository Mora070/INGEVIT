import { BadRequestException } from '@nestjs/common';

const FIRMA_PNG = Buffer.from([
  137, 80, 78, 71, 13, 10, 26, 10,
]);

/**
 * Lee el número de fotogramas declarado antes del primer bloque IDAT.
 *
 * Un PNG estático no contiene acTL y se considera de un fotograma.
 * En APNG, acTL debe aparecer antes de los datos de imagen.
 *
 * Esta función inspecciona encabezados, sin descomprimir píxeles
 * ni modificar el archivo. No sustituye la decodificación de Sharp
 * ni constituye un validador completo de PNG.
 */
export function leerFotogramasPng(contenido: Buffer): number {
  const rechazar = (): never => {
    throw new BadRequestException(
      'No se pudo interpretar la fotografía recibida.',
    );
  };

  if (
    contenido.length < FIRMA_PNG.length ||
    !contenido.subarray(0, FIRMA_PNG.length).equals(FIRMA_PNG)
  ) {
    return rechazar();
  }

  let posicion = FIRMA_PNG.length;
  let fotogramas = 1;
  let controlEncontrado = false;

  while (posicion < contenido.length) {
    /*
     * Cada bloque incluye:
     * longitud (4), tipo (4), datos y CRC (4).
     * Comprobamos los límites antes de leer sus campos.
     */
    if (contenido.length - posicion < 12) {
      return rechazar();
    }

    const longitud = contenido.readUInt32BE(posicion);

    if (longitud > contenido.length - posicion - 12) {
      return rechazar();
    }

    const tipo = contenido.toString(
      'ascii',
      posicion + 4,
      posicion + 8,
    );

    if (tipo === 'acTL') {
      // acTL contiene num_frames y num_plays: ocho bytes.
      if (controlEncontrado || longitud !== 8) {
        return rechazar();
      }

      controlEncontrado = true;
      fotogramas = contenido.readUInt32BE(posicion + 8);

      if (fotogramas === 0) {
        return rechazar();
      }
    }

    if (tipo === 'IDAT') {
      return fotogramas;
    }

    if (tipo === 'IEND') {
      // No encontramos los datos de imagen esperados.
      return rechazar();
    }

    posicion += longitud + 12;
  }

  return rechazar();
}