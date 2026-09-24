import { Injectable, NotFoundException } from '@nestjs/common';
import { CapasTeselasRepository } from './capas-teselas.repository';

/** URL explícita: nunca se construye a partir de Host o X-Forwarded-Host. */
export function getCapasApiPublicaUrl(env: NodeJS.ProcessEnv = process.env): string {
  const valor = env.CAPAS_API_PUBLICA_URL;
  if (!valor || /[\s\\]/.test(valor)) {
    throw new Error('CAPAS_API_PUBLICA_URL debe contener una URL HTTP(S) absoluta.');
  }
  const url = new URL(valor);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || url.search || url.hash) {
    throw new Error('CAPAS_API_PUBLICA_URL no admite credenciales, consultas ni fragmentos.');
  }
  return url.toString().replace(/\/+$/, '');
}

/** Descriptor de una colección publicada; no contiene rutas físicas ni secretos. */
@Injectable()
export class CapasTilejsonService {
  constructor(private readonly repositorio: CapasTeselasRepository) {}

  async obtener(proyecto: string, capa: string, version: string, usuario: string) {
    const fila = await this.repositorio.buscarDisponible(proyecto, capa, version, usuario);
    if (!fila) throw new NotFoundException('La capa no está disponible.');

    const valores = [fila.bbox_oeste, fila.bbox_sur, fila.bbox_este, fila.bbox_norte];
    if (valores.some(v => typeof v !== 'string' || v.trim() === '' || !Number.isFinite(Number(v)))) {
      throw new Error('La capa publicada no tiene una extensión válida.');
    }
    const bounds = valores.map(Number);
    const [oeste, sur, este, norte] = bounds;
    if (oeste < -180 || este > 180 || oeste >= este || sur < -90 || norte > 90 || sur >= norte) {
      throw new Error('La extensión publicada está fuera de rango.');
    }
    if (!Number.isInteger(fila.teselas_zoom_min) || !Number.isInteger(fila.teselas_zoom_max)
        || fila.teselas_zoom_min < 0 || fila.teselas_zoom_max > 30
        || fila.teselas_zoom_min > fila.teselas_zoom_max) {
      throw new Error('Los niveles publicados no son válidos.');
    }
    const base = getCapasApiPublicaUrl();
    const prefijo = `${base}/proyectos/${encodeURIComponent(proyecto)}`
      + `/capas/${encodeURIComponent(fila.id_capa)}`
      + `/teselas/${encodeURIComponent(fila.teselas_version)}`;
    return {
      tilejson: '3.0.0',
      name: fila.nombre,
      scheme: 'xyz',
      tiles: [`${prefijo}/{z}/{x}/{y}.png`],
      minzoom: fila.teselas_zoom_min,
      maxzoom: fila.teselas_zoom_max,
      bounds,
    };
  }
}
