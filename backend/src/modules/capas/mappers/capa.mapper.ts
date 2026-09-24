import type { CapaResponse, CapaRow } from '../types/capa.types';
import { mapearTeselasCapa } from './teselas-capa.mapper';

function numero(
  valor: unknown,
  minimo: number,
  maximo: number,
): number {
  if (
    typeof valor !== 'string'
    || valor.trim() !== valor
    || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(valor)
  ) {
    throw new Error('La capa contiene datos numéricos inválidos.');
  }

  const convertido = Number(valor);

  if (
    !Number.isFinite(convertido)
    || convertido < minimo
    || convertido > maximo
  ) {
    throw new Error('La capa contiene datos numéricos inválidos.');
  }

  return convertido;
}

/**
 * Construye el contrato público sin modificar el registro.
 *
 * El tamaño permanece como texto para conservar la precisión de bigint.
 * El bounding box siempre utiliza WGS84, aunque el CRS original sea otro.
 * No expone claves de almacenamiento, trabajos ni errores internos.
 */
export function mapearCapa(capa: CapaRow): CapaResponse {
  const estados = ['PENDIENTE', 'PROCESANDO', 'LISTA', 'ERROR'];

  if (!estados.includes(capa.estado_procesamiento)) {
    throw new Error('La capa contiene un estado inválido.');
  }

  if (
    typeof capa.tamano_original_bytes !== 'string'
    || capa.tamano_original_bytes.trim() !== capa.tamano_original_bytes
    || !/^[1-9]\d*$/.test(capa.tamano_original_bytes)
    || BigInt(capa.tamano_original_bytes) > 9223372036854775807n
  ) {
    throw new Error('La capa contiene un tamaño inválido.');
  }

  if (
    typeof capa.visible !== 'boolean'
    || !Number.isInteger(capa.orden)
    || capa.orden < 0
    || capa.orden > 2147483647
  ) {
    throw new Error('La capa contiene una configuración inválida.');
  }

  let bbox: CapaResponse['bbox'] = null;

  const limites = [
    capa.bbox_oeste,
    capa.bbox_sur,
    capa.bbox_este,
    capa.bbox_norte,
  ];

  if (!limites.every((valor) => valor === null)) {
    bbox = [
      numero(capa.bbox_oeste, -180, 180),
      numero(capa.bbox_sur, -90, 90),
      numero(capa.bbox_este, -180, 180),
      numero(capa.bbox_norte, -90, 90),
    ];

    if (bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) {
      throw new Error('La capa contiene una extensión geográfica inválida.');
    }
  }

  const teselas = mapearTeselasCapa(capa);

  if (
    capa.estado_procesamiento === 'LISTA'
    && (
      bbox === null
      || typeof capa.crs_original !== 'string'
      || capa.crs_original.trim() === ''
      || teselas === null
    )
  ) {
    throw new Error('La capa lista tiene metadatos incompletos.');
  }

  return {
    id_capa: capa.id_capa,
    id_proyecto: capa.id_proyecto,
    id_usuario_subida: capa.id_usuario_subida,
    nombre: capa.nombre,
    descripcion: capa.descripcion,
    nombre_archivo_original: capa.nombre_archivo_original,
    tamano_original_bytes: capa.tamano_original_bytes,
    crs_original: capa.crs_original,
    bbox,
    estado_procesamiento: capa.estado_procesamiento,
    teselas:
      capa.estado_procesamiento === 'LISTA'
        ? teselas
        : null,
    opacidad: numero(capa.opacidad, 0, 1),
    visible: capa.visible,
    orden: capa.orden,
    fecha_creacion: capa.fecha_creacion.toISOString(),
    fecha_actualizacion: capa.fecha_actualizacion.toISOString(),
  };
}