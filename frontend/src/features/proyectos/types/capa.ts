export type EstadoProcesamientoCapa =
  | 'PENDIENTE'
  | 'PROCESANDO'
  | 'LISTA'
  | 'ERROR';

export interface TeselasCapa {
  version: string;
  zoom_min: number;
  zoom_max: number;
  tamano: number;
  total: string;
}

export interface CapaProyecto {
  id_capa: string;
  id_proyecto: string;
  id_usuario_subida: string;

  nombre: string;
  descripcion: string;
  nombre_archivo_original: string;

  /**
   * Se mantiene como string porque el backend
   * lo expone así para evitar pérdida de precisión.
   */
  tamano_original_bytes: string;

  crs_original: string | null;

  /**
   * WGS84:
   * [oeste, sur, este, norte]
   */
  bbox:
    | [
        number,
        number,
        number,
        number,
      ]
    | null;

  estado_procesamiento:
    EstadoProcesamientoCapa;

  teselas:
    TeselasCapa | null;

  opacidad: number;

  visible: boolean;

  orden: number;

  fecha_creacion: string;

  fecha_actualizacion: string;
}

export interface CapasPaginadas {
  capas: CapaProyecto[];

  pagina: number;

  limite: number;

  total: number;

  total_paginas: number;
}

export interface DatosSubirCapa {
  nombre: string;

  descripcion: string;

  archivo: File;
}

export interface DatosActualizarConfiguracionCapa {
  opacidad: number;

  visible: boolean;

  orden: number;
}

export interface TileJsonCapa {
  tilejson: '3.0.0';

  name: string;

  scheme: 'xyz';

  tiles: string[];

  minzoom: number;

  maxzoom: number;

  bounds: [
    number,
    number,
    number,
    number,
  ];
}