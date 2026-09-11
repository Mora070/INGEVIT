import {
  lstat,
  open,
  realpath,
} from 'node:fs/promises';

import { dirname, relative } from 'node:path';
import type { Readable } from 'node:stream';

import {
  prepararRaizAlmacenamiento,
} from './preparar-raiz-almacenamiento';

import {
  resolverRutaAlmacenamiento,
} from './resolver-ruta-almacenamiento';

/**
 * Abre un archivo local para lectura.
 *
 * Precondiciones:
 * - El servicio que llama ya comprobó la autorización.
 * - La clave procede de los metadatos internos del backend.
 * - Los directorios están bajo control del backend.
 *
 * El consumidor debe gestionar los errores del flujo y destruirlo
 * si se cancela la transferencia.
 */
export async function abrirArchivoLocal(
  directorioRaiz: string,
  clave: string,
): Promise<Readable> {
  const raizReal = await prepararRaizAlmacenamiento(
    directorioRaiz,
  );

  const rutaArchivo = resolverRutaAlmacenamiento(
    raizReal,
    clave,
  );

  const directorioCategoria = dirname(rutaArchivo);
  const informacionCategoria = await lstat(directorioCategoria);

  if (informacionCategoria.isSymbolicLink()) {
    throw new Error(
      'La carpeta de origen no puede ser un enlace simbólico ni una unión de directorios.',
    );
  }

  if (!informacionCategoria.isDirectory()) {
    throw new Error(
      'La carpeta de origen debe ser un directorio.',
    );
  }

  const ubicacionReal = await realpath(directorioCategoria);

  if (relative(directorioCategoria, ubicacionReal) !== '') {
    throw new Error(
      'La ubicación real del origen no coincide con la carpeta esperada.',
    );
  }

  /*
   * Inspeccionamos la entrada antes de abrirla.
   * Un archivo ausente produce ENOENT, que se propaga al consumidor.
   */
  const informacionArchivo = await lstat(rutaArchivo);

  if (informacionArchivo.isSymbolicLink()) {
    throw new Error(
      'El archivo de almacenamiento no puede ser un enlace simbólico.',
    );
  }

  if (!informacionArchivo.isFile()) {
    throw new Error(
      'La clave de almacenamiento debe identificar un archivo regular.',
    );
  }

  const archivo = await open(rutaArchivo, 'r');

  try {
    /*
     * Comprobamos el archivo efectivamente abierto.
     * Comparar dispositivo e identificador ayuda a detectar que la
     * entrada haya sido sustituida entre la inspección y la apertura.
     */
    const informacionAbierta = await archivo.stat();

    if (
      !informacionAbierta.isFile()
      || informacionAbierta.dev !== informacionArchivo.dev
      || informacionAbierta.ino !== informacionArchivo.ino
    ) {
      throw new Error(
        'El archivo cambió durante la apertura.',
      );
    }

    /*
     * El flujo utiliza el descriptor ya comprobado.
     * No vuelve a abrir el archivo mediante su ruta.
     */
    return archivo.createReadStream({
      autoClose: true,
    });
  } catch (error: unknown) {
    try {
      await archivo.close();
    } catch (errorCierre: unknown) {
      throw new AggregateError(
        [error, errorCierre],
        'Falló la apertura y no pudo cerrarse el archivo.',
      );
    }

    throw error;
  }
}