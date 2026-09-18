import {
  lstat,
  realpath,
  unlink,
} from 'node:fs/promises';

import { dirname, relative } from 'node:path';

import {
  prepararRaizAlmacenamiento,
} from './preparar-raiz-almacenamiento';

import {
  resolverRutaAlmacenamiento,
} from './resolver-ruta-almacenamiento';

/**
 * Reconoce específicamente un archivo o entrada inexistente.
 * Los errores de permisos y demás fallos deben propagarse.
 */
function esErrorNoExiste(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'ENOENT'
  );
}

/**
 * Elimina un archivo identificado por una clave interna.
 *
 * Precondiciones:
 * - El servicio que llama ya comprobó la autorización.
 * - La clave procede de los metadatos del backend.
 * - Los directorios están bajo control del backend.
 *
 * No elimina directorios ni modifica registros de PostgreSQL.
 * Un archivo ya inexistente se considera una operación completada.
 */
export async function eliminarArchivoLocal(
  directorioRaiz: string,
  clave: string,
): Promise<void> {
  const raizReal = await prepararRaizAlmacenamiento(
    directorioRaiz,
  );

  const rutaArchivo = resolverRutaAlmacenamiento(
    raizReal,
    clave,
  );

  const directorioCategoria = dirname(rutaArchivo);
  const informacionCategoria = await lstat(directorioCategoria);

  /*
   * La raíz y la categoría deben existir y ser válidas.
   * Su ausencia es un problema de almacenamiento, no simplemente
   * un archivo que ya fue eliminado.
   */
  if (informacionCategoria.isSymbolicLink()) {
    throw new Error(
      'La carpeta de destino no puede ser un enlace simbólico ni una unión de directorios.',
    );
  }

  if (!informacionCategoria.isDirectory()) {
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

  try {
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
  } catch (error: unknown) {
    if (esErrorNoExiste(error)) {
      return;
    }

    throw error;
  }

  try {
    // unlink elimina una entrada de archivo; no hace borrado recursivo.
    await unlink(rutaArchivo);
  } catch (error: unknown) {
    /*
     * Otra operación puede haberlo eliminado después de lstat.
     * Ese caso también se considera completado.
     */
    if (esErrorNoExiste(error)) {
      return;
    }

    throw error;
  }
}