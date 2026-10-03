import type {
  FotografiaProyecto,
} from './fotografia';

import type {
  PanoramicaProyecto,
} from './panoramica';

import type {
  PlanoProyecto,
} from './plano';

export type TipoRecursoCarpeta =
  | 'FOTOGRAFIA'
  | 'PANORAMICA'
  | 'PLANO';

export interface CarpetaProyecto {
  id_carpeta: string;

  id_proyecto: string;

  id_carpeta_padre: string | null;

  id_usuario_creacion: string;

  nombre: string;

  fecha_creacion: string;

  fecha_actualizacion: string;
}

export interface FotografiaCarpeta
  extends FotografiaProyecto {
  fecha_agregada: string;
}

export interface PanoramicaCarpeta
  extends PanoramicaProyecto {
  fecha_agregada: string;
}

export interface PlanoCarpeta
  extends PlanoProyecto {
  fecha_agregada: string;
}

export interface ContenidoCarpeta {
  carpeta: CarpetaProyecto;

  subcarpetas: CarpetaProyecto[];

  fotografias: FotografiaCarpeta[];

  panoramicas: PanoramicaCarpeta[];

  planos: PlanoCarpeta[];
}