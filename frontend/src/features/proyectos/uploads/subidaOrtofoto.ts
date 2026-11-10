import { subirFormulario } from '../../../shared/api/subirFormulario';
import type { CapaProyecto, DatosSubirCapa } from '../types/capa';

export interface SubidaOrtofoto {
  proyecto: string;
  nombre: string;
  archivo: string;
  tamano: number;
  enviados: number;
  total: number | null;
  estado: 'subiendo' | 'confirmando' | 'recibida' | 'error';
  mensaje?: string;
  detalles: boolean;
}

let estado: SubidaOrtofoto | null = null;
let controlador: AbortController | null = null;
const oyentes = new Set<() => void>();
export const obtenerSubida = () => estado;
export function observarSubida(oyente: () => void) {
  oyentes.add(oyente);
  return () => { oyentes.delete(oyente); };
}
function publicar(nuevo: SubidaOrtofoto | null) {
  estado = nuevo;
  oyentes.forEach(oyente => oyente());
}
export const subidaActiva = () => estado?.estado === 'subiendo' || estado?.estado === 'confirmando';
export function mostrarDetallesSubida(detalles: boolean) {
  if (estado) publicar({ ...estado, detalles });
}
export function descartarSubida() {
  if (!subidaActiva()) publicar(null);
}
export function interrumpirSubida() { controlador?.abort(); }
export function limpiarSubidaSesion() {
  const anterior = controlador;
  controlador = null;
  publicar(null);
  anterior?.abort();
}

// Vive fuera del formulario y de las páginas: navegar dentro de la app no
// desmonta ni cancela la petición. No persiste File ni credenciales en disco.
export function iniciarSubidaOrtofoto(proyecto: string, datos: DatosSubirCapa) {
  if (subidaActiva()) throw new Error('Ya hay una ortofoto subiendo. Consulta la tarjeta de progreso.');
  const abortador = new AbortController();
  controlador = abortador;
  const trabajo: SubidaOrtofoto = {
    proyecto, nombre: datos.nombre, archivo: datos.archivo.name,
    tamano: datos.archivo.size, enviados: 0, total: null,
    estado: 'subiendo', detalles: false,
  };
  const formulario = new FormData();
  formulario.append('nombre', datos.nombre);
  formulario.append('descripcion', datos.descripcion);
  formulario.append('archivo', datos.archivo);
  publicar(trabajo);
  void subirFormulario<CapaProyecto>(
    `/api/proyectos/${encodeURIComponent(proyecto)}/capas`, formulario, abortador.signal,
    progreso => {
      if (!estado || controlador !== abortador) return;
      publicar({ ...estado,
        enviados: progreso.transferenciaCompleta ? estado.enviados : progreso.enviados,
        total: progreso.transferenciaCompleta ? estado.total : progreso.total,
        estado: progreso.transferenciaCompleta ? 'confirmando' : 'subiendo',
      });
    },
  ).then(capa => {
    if (!estado || controlador !== abortador) return;
    publicar({ ...estado, estado: 'recibida', detalles: false });
    window.dispatchEvent(new CustomEvent('ingevit:ortofoto-recibida', {
      detail: { proyecto, capa },
    }));
  }).catch((error: unknown) => {
    if (!estado || controlador !== abortador) return;
    publicar({ ...estado, estado: 'error',
      mensaje: error instanceof Error ? error.message : 'No se pudo completar la subida.',
    });
  }).finally(() => {
    if (controlador === abortador) controlador = null;
  });
}
