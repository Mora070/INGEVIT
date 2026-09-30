export type EstadoIncidencia =
  | 'PENDIENTE'
  | 'EN_PROCESO'
  | 'SOLUCIONADA';

export type PrioridadIncidencia =
  | 'BAJA'
  | 'MEDIA'
  | 'ALTA';

/**
 * Incidencia ubicada sobre un plano PDF.
 */
export interface IncidenciaPlano {
  id_incidencia: string;

  id_proyecto: string;

  id_plano: string;

  id_creador: string;

  titulo: string;

  descripcion: string;

  estado: EstadoIncidencia;

  prioridad: PrioridadIncidencia;

  numero_pagina: number;

  coordenada_x: number;

  coordenada_y: number;

  fecha_creacion: string;
}

/**
 * Incidencia geográfica creada directamente
 * en el mapa del proyecto.
 *
 * Puede ser:
 *
 * - texto:
 *   id_fotografia = null
 *   id_panoramica = null
 *
 * - fotografía:
 *   id_fotografia != null
 *   id_panoramica = null
 *
 * - panorámica 360:
 *   id_fotografia = null
 *   id_panoramica != null
 *
 * La ubicación pertenece siempre
 * a la incidencia.
 */
export interface IncidenciaMapa {
  id_incidencia: string;

  id_proyecto: string;

  id_plano: null;

  id_creador: string;

  titulo: string;

  descripcion: string;

  estado: EstadoIncidencia;

  prioridad: PrioridadIncidencia;

  numero_pagina: null;

  coordenada_x: null;

  coordenada_y: null;

  latitud: number;

  longitud: number;

  id_fotografia: string | null;

  id_panoramica: string | null;

  fecha_creacion: string;
}

/**
 * Respuesta paginada de incidencias de plano.
 */
export interface IncidenciasPaginadas {
  incidencias: IncidenciaPlano[];

  numero_pagina: number;

  pagina: number;

  limite: number;

  total: number;

  total_paginas: number;
}

/**
 * Respuesta paginada de incidencias
 * geográficas del mapa.
 */
export interface IncidenciasMapaPaginadas {
  incidencias: IncidenciaMapa[];

  pagina: number;

  limite: number;

  total: number;

  total_paginas: number;
}

/**
 * Datos comunes de cualquier incidencia
 * creada directamente en el mapa.
 *
 * Todas requieren ubicación.
 */
interface DatosBaseCrearIncidenciaMapa {
  titulo: string;

  descripcion: string;

  prioridad: PrioridadIncidencia;

  latitud: number;

  longitud: number;
}

/**
 * Incidencia de texto.
 *
 * El usuario selecciona manualmente
 * la ubicación sobre el mapa.
 */
export interface DatosCrearIncidenciaMapaTexto
  extends DatosBaseCrearIncidenciaMapa {
  id_fotografia?: never;

  id_panoramica?: never;
}

/**
 * Incidencia vinculada a una fotografía
 * existente en la galería.
 *
 * La fotografía no aporta la ubicación.
 * El usuario también selecciona el punto
 * directamente sobre el mapa.
 */
export interface DatosCrearIncidenciaMapaFotografia
  extends DatosBaseCrearIncidenciaMapa {
  id_fotografia: string;

  id_panoramica?: never;
}

/**
 * Incidencia vinculada a una panorámica 360°
 * existente.
 *
 * La panorámica no aporta la ubicación.
 * El usuario también selecciona el punto
 * directamente sobre el mapa.
 */
export interface DatosCrearIncidenciaMapaPanoramica
  extends DatosBaseCrearIncidenciaMapa {
  id_panoramica: string;

  id_fotografia?: never;
}

export type DatosCrearIncidenciaMapa =
  | DatosCrearIncidenciaMapaTexto
  | DatosCrearIncidenciaMapaFotografia
  | DatosCrearIncidenciaMapaPanoramica;