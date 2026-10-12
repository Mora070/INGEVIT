
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
 * Asociación con capas:
 *
 * - id_capa != null:
 *   La incidencia pertenece a una capa
 *   específica del proyecto.
 *
 * - id_capa = null:
 *   La incidencia es general del mapa.
 *
 * La ubicación pertenece siempre
 * a la incidencia.
 *
 * Cuando se elimina una capa, PostgreSQL
 * elimina sus incidencias asociadas
 * mediante ON DELETE CASCADE.
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

  id_capa: string | null;

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
 *
 * id_capa es opcional para mantener
 * compatibilidad con las incidencias
 * generales del mapa.
 *
 * Si se proporciona, el backend valida
 * que la capa pertenezca al proyecto
 * y esté disponible.
 */
interface DatosBaseCrearIncidenciaMapa {
  titulo: string;

  descripcion: string;

  prioridad: PrioridadIncidencia;

  latitud: number;

  longitud: number;

  id_capa?: string | null;
}

/**
 * Incidencia de texto.
 *
 * El usuario selecciona manualmente
 * la ubicación sobre el mapa.
 *
 * Puede asociarse a una capa visible
 * o permanecer como incidencia general.
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
 *
 * La incidencia puede asociarse
 * a una capa del proyecto.
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
 *
 * La incidencia puede asociarse
 * a una capa del proyecto.
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
