import { ApiError, http } from '../../../shared/api/http';
import { subirFormulario } from '../../../shared/api/subirFormulario';
import type { CapaProyecto, CapasPaginadas, DatosSubirCapa } from '../types/capa';

type Fase = 'subiendo' | 'confirmando' | 'pendiente' | 'procesando' | 'lista' | 'cancelada' | 'error';
export interface SubidaOrtofoto {
  id: number;
  proyecto: string;
  nombre: string;
  archivo: string;
  tamano: number;
  enviados: number;
  total: number | null;
  estado: Fase;
  capaId?: string;
  mensaje?: string;
  avisoEstado?: string;
  detalles: boolean;
}

let estado: SubidaOrtofoto | null = null;
let version = 0;
let controlador: AbortController | null = null;
let consulta: AbortController | null = null;
let temporizador: ReturnType<typeof setTimeout> | undefined;
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
function detenerSeguimiento() {
  clearTimeout(temporizador);
  temporizador = undefined;
  consulta?.abort();
  consulta = null;
}
function retirarDespues(id: number) {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    if (estado?.id === id && (estado.estado === 'lista' || estado.estado === 'cancelada')) descartarSubida();
  }, 4000);
}
export const subidaActiva = () => estado?.estado === 'subiendo' || estado?.estado === 'confirmando';
export function mostrarDetallesSubida(detalles: boolean) {
  if (estado) publicar({ ...estado, detalles });
}
export function descartarSubida() {
  if (subidaActiva()) return;
  version += 1;
  detenerSeguimiento();
  publicar(null);
}
export function interrumpirSubida() {
  if (estado?.estado !== 'subiendo' || !controlador) return;
  const id = estado.id;
  publicar({ ...estado, estado: 'cancelada', detalles: false, mensaje: undefined });
  controlador.abort();
  retirarDespues(id);
}
export function limpiarSubidaSesion() {
  version += 1;
  detenerSeguimiento();
  const anterior = controlador;
  controlador = null;
  publicar(null);
  anterior?.abort();
}

function faseCapa(capa: CapaProyecto): Fase {
  switch (capa.estado_procesamiento) {
    case 'LISTA': return 'lista';
    case 'PROCESANDO': return 'procesando';
    case 'ERROR': return 'error';
    default: return 'pendiente';
  }
}
function aplicarCapa(capa: CapaProyecto, id: number) {
  if (!estado || estado.id !== id || version !== id || estado.capaId !== capa.id_capa) return;
  const fase = faseCapa(capa);
  publicar({ ...estado, estado: fase, avisoEstado: undefined,
    mensaje: fase === 'error' ? 'No se pudo procesar la ortofoto. Consulta la capa en el proyecto para reintentar.' : undefined });
  if (fase === 'lista') retirarDespues(id);
}

async function consultarEstado(id: number) {
  if (!estado || version !== id || estado.id !== id
      || !estado.capaId || !['pendiente', 'procesando'].includes(estado.estado)) return;
  const { proyecto, capaId } = estado;
  const abortador = new AbortController();
  consulta = abortador;
  try {
    let pagina = 1;
    let paginas = 1;
    let encontrada = false;
    do {
      const respuesta = await http<CapasPaginadas>(
        `/api/proyectos/${encodeURIComponent(proyecto)}/capas?pagina=${pagina}&limite=100`,
        { signal: abortador.signal },
      );
      if (version !== id || abortador.signal.aborted) return;
      if (!Array.isArray(respuesta.capas) || !Number.isSafeInteger(respuesta.total_paginas)
          || respuesta.total_paginas < 0) throw new Error('Respuesta de capas no válida.');
      const capa = respuesta.capas.find(c => c.id_capa === capaId);
      if (capa) { aplicarCapa(capa, id); encontrada = true; break; }
      paginas = respuesta.total_paginas;
      pagina += 1;
    } while (pagina <= paginas);
    if (!encontrada && estado?.id === id) {
      publicar({ ...estado, estado: 'error', mensaje: 'La capa ya no está disponible en el proyecto.' });
    }
  } catch (error) {
    if (version !== id || abortador.signal.aborted || !estado || estado.id !== id) return;
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      publicar({ ...estado, estado: 'error', mensaje: 'No se puede consultar la capa. Revisa la sesión y el acceso al proyecto.' });
    } else {
      publicar({ ...estado, avisoEstado: 'No se pudo actualizar el estado. Volveremos a consultarlo.' });
    }
  } finally {
    if (consulta === abortador) consulta = null;
    if (estado?.id === id && version === id && ['pendiente', 'procesando'].includes(estado.estado)) {
      temporizador = setTimeout(() => { void consultarEstado(id); }, 5000);
    }
  }
}

// Estado independiente de las páginas. Nunca se relacionan archivos por nombre:
// el seguimiento comienza solo con el id_capa confirmado por el POST original.
export function iniciarSubidaOrtofoto(proyecto: string, datos: DatosSubirCapa) {
  if (subidaActiva()) throw new Error('Ya hay una ortofoto subiendo. Consulta la tarjeta de progreso.');
  detenerSeguimiento();
  const id = ++version;
  const abortador = new AbortController();
  controlador = abortador;
  const trabajo: SubidaOrtofoto = {
    id, proyecto, nombre: datos.nombre, archivo: datos.archivo.name,
    tamano: datos.archivo.size, enviados: 0, total: null, estado: 'subiendo', detalles: false,
  };
  const formulario = new FormData();
  formulario.append('nombre', datos.nombre);
  formulario.append('descripcion', datos.descripcion);
  formulario.append('archivo', datos.archivo);
  publicar(trabajo);
  void subirFormulario<CapaProyecto>(
    `/api/proyectos/${encodeURIComponent(proyecto)}/capas`, formulario, abortador.signal,
    progreso => {
      // Un callback tardío nunca devuelve a "confirmando" una capa ya aceptada.
      if (!estado || estado.id !== id || version !== id || estado.estado !== 'subiendo') return;
      publicar({ ...estado,
        enviados: progreso.transferenciaCompleta ? estado.enviados : progreso.enviados,
        total: progreso.transferenciaCompleta ? estado.total : progreso.total,
        estado: progreso.transferenciaCompleta ? 'confirmando' : 'subiendo',
      });
    },
  ).then(capa => {
    if (!estado || estado.id !== id || version !== id || estado.estado === 'cancelada') return;
    publicar({ ...estado, capaId: capa.id_capa, estado: faseCapa(capa), detalles: false });
    aplicarCapa(capa, id);
    window.dispatchEvent(new CustomEvent('ingevit:ortofoto-recibida', { detail: { proyecto, capa } }));
    if (['pendiente', 'procesando'].includes(estado?.estado ?? '')) {
      temporizador = setTimeout(() => { void consultarEstado(id); }, 5000);
    }
  }).catch((error: unknown) => {
    if (!estado || estado.id !== id || version !== id || estado.estado === 'cancelada') return;
    publicar({ ...estado, estado: 'error', mensaje: error instanceof Error ? error.message : 'No se pudo completar la subida.' });
  }).finally(() => {
    if (controlador === abortador) controlador = null;
  });
}
