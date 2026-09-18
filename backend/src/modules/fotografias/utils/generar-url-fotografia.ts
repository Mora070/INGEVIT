import {
  validarClaveAlmacenamiento,
} from '../../almacenamiento/utils/validar-clave-almacenamiento';

const PATRON_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Construye la referencia de acceso a la versión optimizada.
 *
 * Devuelve una ruta relativa al origen del backend.
 * No comprueba autorización ni existencia del archivo.
 *
 * La clave debe proceder del backend, nunca del cuerpo de la petición.
 */
export function generarUrlFotografia(
  idProyecto: string,
  claveOptimizada: string,
): string {
  if (
    typeof idProyecto !== 'string'
    || idProyecto.includes('\n')
    || idProyecto.includes('\r')
    || !PATRON_UUID.test(idProyecto)
  ) {
    throw new Error(
      'El identificador del proyecto debe ser un UUID válido.',
    );
  }

  const clave = validarClaveAlmacenamiento(claveOptimizada);

  if (
    !clave.startsWith('fotografias/')
    || !clave.endsWith('.webp')
  ) {
    throw new Error(
      'La URL de fotografía debe corresponder a una versión optimizada WebP.',
    );
  }

  // La validación de la clave garantiza categoría y nombre, sin subcarpetas.
  const nombreArchivo = clave.slice('fotografias/'.length);

  return (
    `/api/proyectos/${idProyecto.toLowerCase()}`
    + `/fotografias/archivos/${encodeURIComponent(nombreArchivo)}`
  );
}