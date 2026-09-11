import { lstat, mkdir, realpath } from 'node:fs/promises';
import { join, relative } from 'node:path';

import {
  prepararRaizAlmacenamiento,
} from './preparar-raiz-almacenamiento';

/**
 * Categorías admitidas actualmente por las claves de almacenamiento.
 * Deben mantenerse alineadas con validarClaveAlmacenamiento.
 */
const CATEGORIAS = [
  'fotografias',
  'planos',
  'panoramicas',
] as const;

/**
 * Identifica un error del sistema de archivos sin asumir
 * que cualquier valor capturado sea una instancia de Error.
 */
function tieneCodigo(
  error: unknown,
  codigo: string,
): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === codigo
  );
}

/**
 * Prepara las carpetas de categorías y devuelve la raíz canónica.
 *
 * La raíz debe existir previamente.
 * Solo crea los subdirectorios conocidos; no elimina ni reemplaza entradas.
 *
 * Esta comprobación corresponde a la inicialización. Las operaciones
 * de archivos deberán comprobar también sus rutas al ejecutarse.
 */
export async function prepararDirectoriosAlmacenamiento(
  directorioRaiz: string,
): Promise<string> {
  const raizReal = await prepararRaizAlmacenamiento(
    directorioRaiz,
  );

  for (const categoria of CATEGORIAS) {
    const directorioCategoria = join(raizReal, categoria);

    try {
      /*
       * No usamos recursive: true:
       * la raíz ya existe y solo queremos crear este directorio.
       */
      await mkdir(directorioCategoria);
    } catch (error: unknown) {
      /*
       * Si existe una entrada, todavía debemos comprobar qué es.
       * Los demás errores, incluidos los de permisos, se propagan.
       */
      if (!tieneCodigo(error, 'EEXIST')) {
        throw error;
      }
    }

    const informacion = await lstat(directorioCategoria);

    if (informacion.isSymbolicLink()) {
      throw new Error(
        `La carpeta ${categoria} no puede ser un enlace simbólico ni una unión de directorios.`,
      );
    }

    if (!informacion.isDirectory()) {
      throw new Error(
        `La ubicación de ${categoria} debe ser un directorio.`,
      );
    }

    const ubicacionReal = await realpath(directorioCategoria);

    /*
     * Comprobamos que la ubicación resuelta coincida con la esperada.
     * relative evita comparar rutas mediante prefijos textuales.
     */
    if (relative(directorioCategoria, ubicacionReal) !== '') {
      throw new Error(
        `La ubicación real de ${categoria} no coincide con la carpeta esperada.`,
      );
    }
  }

  return raizReal;
}