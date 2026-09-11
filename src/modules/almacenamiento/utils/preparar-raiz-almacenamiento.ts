import { lstat, realpath } from 'node:fs/promises';

import {
  getAlmacenamientoLocalConfig,
} from '../config/almacenamiento.config';

/**
 * Comprueba la carpeta raíz y devuelve su ubicación canónica.
 *
 * No crea carpetas ni modifica archivos.
 * Rechaza que la propia carpeta configurada sea un enlace simbólico
 * o una unión de directorios reconocida como enlace por Node.
 *
 * La configuración y sus directorios superiores deben estar
 * administrados por una persona de confianza.
 */
export async function prepararRaizAlmacenamiento(
  directorioRaiz: string,
): Promise<string> {
  // Reutilizamos la validación existente sin leer ni modificar process.env.
  const configuracion = getAlmacenamientoLocalConfig({
    STORAGE_LOCAL_ROOT: directorioRaiz,
  });

  /*
   * lstat inspecciona la entrada indicada sin seguir el enlace final.
   * Si la ruta no existe o no es accesible, el error se propaga.
   */
  const informacion = await lstat(configuracion.directorioRaiz);

  if (informacion.isSymbolicLink()) {
    throw new Error(
      'La raíz de almacenamiento no puede ser un enlace simbólico ni una unión de directorios.',
    );
  }

  if (!informacion.isDirectory()) {
    throw new Error(
      'La raíz de almacenamiento debe ser un directorio.',
    );
  }

  /*
   * Resuelve la ubicación real, incluidos los enlaces que pudieran
   * existir en directorios superiores de la configuración.
   *
   * El adaptador utilizará esta ubicación como raíz de referencia.
   */
  const directorioReal = await realpath(
    configuracion.directorioRaiz,
  );

  // También impide aceptar una ubicación real equivalente a una raíz.
  const configuracionReal = getAlmacenamientoLocalConfig({
    STORAGE_LOCAL_ROOT: directorioReal,
  });

  return configuracionReal.directorioRaiz;
}