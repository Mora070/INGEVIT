import { cuerpoJson, http } from '../../../shared/api/http';
import type { EstadoMediciones, RegistroMediciones } from '../components/PlanViewer/autodesk';
export function rutaMediciones(proyecto: string, plano: string, pagina: number) {
  return `/api/proyectos/${proyecto}/planos/${plano}/paginas/${pagina}/mediciones`;
}
export function leerMediciones(ruta: string, signal?: AbortSignal) {
  return http<RegistroMediciones>(ruta, {signal});
}
export function guardarMediciones(ruta: string, version: number, estado: EstadoMediciones) {
  return http<RegistroMediciones>(ruta, {method: 'PUT', ...cuerpoJson({version, estado})});
}
