import {
  isAbsolute,
  normalize,
  parse,
  relative,
  resolve,
  sep,
} from 'node:path';

import {
  validarClaveAlmacenamiento,
} from './validar-clave-almacenamiento';

/**
 * Resuelve la ubicación local correspondiente a una clave interna.
 *
 * Comprueba el formato de la clave y que la ruta resultante sea
 * descendiente de la carpeta raíz configurada.
 *
 * Esta función solo trabaja con rutas como texto:
 * no accede al disco ni comprueba enlaces simbólicos o uniones.
 */
export function resolverRutaAlmacenamiento(
  directorioRaiz: string,
  clave: unknown,
): string {
  const claveValidada = validarClaveAlmacenamiento(clave);

  // Comprobación defensiva para impedir resoluciones relativas al proceso.
  if (
    typeof directorioRaiz !== 'string'
    || directorioRaiz.trim() === ''
    || directorioRaiz !== directorioRaiz.trim()
    || directorioRaiz.includes('\0')
    || !isAbsolute(directorioRaiz)
  ) {
    throw new Error(
      'La raíz de almacenamiento debe ser una ruta absoluta válida.',
    );
  }

  const raizNormalizada = normalize(directorioRaiz);

  if (raizNormalizada === parse(raizNormalizada).root) {
    throw new Error(
      'La raíz de almacenamiento debe indicar una carpeta.',
    );
  }

  /*
   * Las claves utilizan "/" tanto en Windows como en S3.
   * Convertimos sus segmentos mediante las funciones del sistema local.
   */
  const rutaArchivo = resolve(
    raizNormalizada,
    ...claveValidada.split('/'),
  );

  const rutaRelativa = relative(
    raizNormalizada,
    rutaArchivo,
  );

  /*
   * No utilizamos startsWith sobre la ruta absoluta:
   * una carpeta hermana podría compartir el mismo prefijo textual.
   */
  if (
    rutaRelativa === ''
    || rutaRelativa === '..'
    || rutaRelativa.startsWith(`..${sep}`)
    || isAbsolute(rutaRelativa)
  ) {
    throw new Error(
      'La ruta del archivo está fuera del almacenamiento configurado.',
    );
  }

  return rutaArchivo;
}