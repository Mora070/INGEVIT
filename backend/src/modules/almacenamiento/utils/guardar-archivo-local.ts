import {
  lstat,
  open,
  realpath,
  unlink,
} from 'node:fs/promises';

import { dirname, relative } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import {
  prepararRaizAlmacenamiento,
} from './preparar-raiz-almacenamiento';

import {
  resolverRutaAlmacenamiento,
} from './resolver-ruta-almacenamiento';

/**
 * Guarda un archivo nuevo utilizando una clave interna.
 *
 * Precondiciones:
 * - La autorización y la validación del contenido se realizan antes.
 * - Las carpetas de categorías ya fueron preparadas.
 * - Los directorios están bajo control del backend.
 *
 * No modifica PostgreSQL ni genera una URL pública.
 */
export async function guardarArchivoLocal(
  directorioRaiz: string,
  clave: string,
  contenido: Readable,
): Promise<void> {
  const raizReal = await prepararRaizAlmacenamiento(
    directorioRaiz,
  );

  const rutaArchivo = resolverRutaAlmacenamiento(
    raizReal,
    clave,
  );

  const directorioCategoria = dirname(rutaArchivo);
  const informacion = await lstat(directorioCategoria);

  // Volvemos a comprobar la categoría antes de cada escritura.
  if (informacion.isSymbolicLink()) {
    throw new Error(
      'La carpeta de destino no puede ser un enlace simbólico ni una unión de directorios.',
    );
  }

  if (!informacion.isDirectory()) {
    throw new Error(
      'La carpeta de destino debe ser un directorio.',
    );
  }

  const ubicacionReal = await realpath(directorioCategoria);

  if (relative(directorioCategoria, ubicacionReal) !== '') {
    throw new Error(
      'La ubicación real del destino no coincide con la carpeta esperada.',
    );
  }

  /*
   * "wx" crea exclusivamente un archivo nuevo.
   *
   * Si la clave ya existe, open falla antes de entrar al bloque de
   * limpieza. Así no eliminamos un archivo de una operación anterior.
   */
  const archivo = await open(rutaArchivo, 'wx');

  try {
    const destino = archivo.createWriteStream({
      autoClose: true,
    });

    // Coordina la transferencia, la contrapresión y los errores del flujo.
    await pipeline(contenido, destino);
  } catch (error: unknown) {
    const errores: unknown[] = [error];

    /*
     * pipeline normalmente cierra el destino. Cerramos también el
     * FileHandle para cubrir errores al construir el flujo de escritura.
     */
    let cerrado = false;

    try {
      await archivo.close();
      cerrado = true;
    } catch (errorCierre: unknown) {
      errores.push(errorCierre);
    }

    // Solo intentamos eliminarlo después de cerrar el descriptor.
    if (cerrado) {
      try {
        await unlink(rutaArchivo);
      } catch (errorLimpieza: unknown) {
        const yaNoExiste =
          typeof errorLimpieza === 'object'
          && errorLimpieza !== null
          && 'code' in errorLimpieza
          && errorLimpieza.code === 'ENOENT';

        if (!yaNoExiste) {
          errores.push(errorLimpieza);
        }
      }
    }

    if (errores.length > 1) {
      throw new AggregateError(
        errores,
        'Falló la escritura y no pudo completarse la limpieza del archivo.',
      );
    }

    throw error;
  }
}