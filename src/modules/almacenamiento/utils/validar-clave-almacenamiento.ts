/**
 * Patrón de una clave generada internamente por el backend.
 *
 * Acepta:
 * - Una categoría de archivo del sistema.
 * - Un UUID en minúsculas como nombre.
 * - Una extensión de entre 1 y 10 caracteres alfanuméricos.
 *
 * No acepta rutas absolutas, subdirectorios adicionales, espacios,
 * barras invertidas, segmentos ".." ni caracteres codificados con "%".
 *
 * La extensión forma parte del nombre interno. Este patrón NO valida
 * el formato real del archivo ni los formatos permitidos por el negocio.
 */
const PATRON_CLAVE =
  /^(fotografias|planos|panoramicas)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,10}$/;

/**
 * Valida una clave antes de resolver su ubicación de almacenamiento.
 *
 * No recorta espacios, decodifica caracteres ni normaliza la entrada:
 * una clave incorrecta debe rechazarse, no reinterpretarse.
 *
 * Recibe unknown para comprobar también el tipo durante la ejecución.
 * Devuelve la misma clave una vez validada.
 */
export function validarClaveAlmacenamiento(
  clave: unknown,
): string {
  if (typeof clave !== 'string') {
    throw new Error(
      'La clave de almacenamiento debe ser un texto.',
    );
  }

  /*
   * En JavaScript, "$" puede coincidir antes de un salto de línea final.
   * Comprobamos explícitamente estos caracteres para rechazarlo también.
   */
  if (
    clave.includes('\n')
    || clave.includes('\r')
    || !PATRON_CLAVE.test(clave)
  ) {
    throw new Error(
      'La clave de almacenamiento tiene un formato no permitido.',
    );
  }

  return clave;
}