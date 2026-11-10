import { ApiError } from './http';

export interface ProgresoSubida {
  enviados: number;
  total: number | null;
  transferenciaCompleta: boolean;
}

/** Multipart con progreso real. 100 % de envío no equivale a aceptación. */
export function subirFormulario<T>(
  ruta: string,
  formulario: FormData,
  signal: AbortSignal,
  onProgreso: (progreso: ProgresoSubida) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!ruta.startsWith('/api/')) {
      reject(new Error('Las solicitudes deben utilizar una ruta /api/.'));
      return;
    }
    const xhr = new XMLHttpRequest();
    let finalizada = false;
    const abortar = () => xhr.abort();
    const terminar = () => {
      finalizada = true;
      signal.removeEventListener('abort', abortar);
    };
    xhr.open('POST', ruta);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.upload.onprogress = event => { if (!finalizada) onProgreso({
      enviados: event.loaded,
      total: event.lengthComputable ? event.total : null,
      transferenciaCompleta: false,
    }); };
    xhr.upload.onload = () => {
      if (!finalizada) onProgreso({ enviados: 0, total: null, transferenciaCompleta: true });
    };
    const resolver = () => {
      if (finalizada) return;
      terminar();
      let contenido: unknown;
      try {
        contenido = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        reject(new Error('El servidor devolvió una respuesta inesperada. Revisa las capas antes de repetir la subida.'));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        let mensaje = 'No se pudo completar la subida. Revisa las capas antes de volver a intentarlo.';
        if (contenido && typeof contenido === 'object' && 'message' in contenido) {
          const valor = contenido.message;
          if (typeof valor === 'string' && valor.trim()) mensaje = valor;
          else if (Array.isArray(valor)) {
            const textos = valor.filter((v): v is string => typeof v === 'string' && !!v.trim());
            if (textos.length) mensaje = textos.join(' ');
          }
        }
        reject(new ApiError(xhr.status, mensaje));
        return;
      }
      if (!contenido || typeof contenido !== 'object' || !('id_capa' in contenido)
          || typeof contenido.id_capa !== 'string') {
        reject(new Error('No se pudo confirmar la capa recibida. Revisa las capas antes de repetir la subida.'));
        return;
      }
      resolve(contenido as T);
    };
    xhr.onload = resolver;
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4 && xhr.status > 0) resolver();
    };
    xhr.onerror = () => {
      if (finalizada) return;
      terminar();
      reject(new Error('Se perdió la conexión. Revisa las capas antes de volver a enviar el archivo.'));
    };
    xhr.onabort = () => {
      if (finalizada) return;
      terminar();
      reject(new Error('Transferencia interrumpida. El servidor podría haber recibido el archivo; revisa las capas antes de repetirla.'));
    };
    if (signal.aborted) {
      reject(new Error('La transferencia fue interrumpida.'));
      return;
    }
    signal.addEventListener('abort', abortar, { once: true });
    xhr.send(formulario);
  });
}
