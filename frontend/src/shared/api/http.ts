/**
 * Error de una respuesta HTTP del backend.
 *
 * Los errores de red se mantienen como errores independientes:
 * no deben confundirse con una sesión inválida.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Extrae únicamente mensajes de texto del formato de errores de NestJS.
 * Nunca convierte objetos desconocidos directamente en mensajes.
 */
function obtenerMensajeError(contenido: unknown): string | null {
  if (
    typeof contenido !== 'object' ||
    contenido === null ||
    !('message' in contenido)
  ) {
    return null;
  }

  const mensaje = contenido.message;

  if (typeof mensaje === 'string' && mensaje.trim()) {
    return mensaje;
  }

  if (Array.isArray(mensaje)) {
    const mensajes = mensaje.filter(
      (valor): valor is string =>
        typeof valor === 'string' && valor.trim().length > 0,
    );

    if (mensajes.length > 0) {
      return mensajes.join(' ');
    }
  }

  return null;
}

/**
 * Ejecuta solicitudes contra el backend mediante el proxy /api.
 *
 * - La cookie HttpOnly la administra el navegador.
 * - No lee ni almacena tokens.
 * - Permite FormData sin imponer Content-Type.
 * - Permite cancelar solicitudes mediante signal.
 * - No reintenta automáticamente operaciones que podrían modificar datos.
 *
 * El genérico describe la respuesta esperada; no valida su estructura
 * durante la ejecución.
 */
export async function http<T>(
  ruta: string,
  opciones: RequestInit = {},
): Promise<T> {
  if (!ruta.startsWith('/api/')) {
    throw new Error('Las solicitudes deben utilizar una ruta /api/.');
  }

  const headers = new Headers(opciones.headers);
  headers.set('Accept', 'application/json');

  const respuesta = await fetch(ruta, {
    ...opciones,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });

  const texto = await respuesta.text();
  let contenido: unknown;

  if (texto) {
    try {
      contenido = JSON.parse(texto);
    } catch {
      if (respuesta.ok) {
        throw new Error('El servidor devolvió una respuesta inesperada.');
      }
    }
  }

  if (!respuesta.ok) {
    throw new ApiError(
      respuesta.status,
      obtenerMensajeError(contenido) ??
        'No se pudo completar la solicitud.',
    );
  }

  return contenido as T;
}

/** Construye un cuerpo JSON sin modificar los valores proporcionados. */
export function cuerpoJson(datos: unknown): Pick<
  RequestInit,
  'body' | 'headers'
> {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  };
}