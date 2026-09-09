/**
 * Estados de trabajo definidos para los proyectos.
 *
 * No representan eliminación lógica ni disponibilidad de acceso.
 */
export type EstadoProyecto =
  | 'ACTIVA'
  | 'PAUSA'
  | 'FINALIZADA';

/**
 * Resultado interno de las consultas de proyectos.
 *
 * Decisiones de representación:
 *
 * - Las fechas DATE se seleccionarán explícitamente como texto
 *   YYYY-MM-DD en el repositorio, evitando conversiones de zona horaria.
 *
 * - PostgreSQL NUMERIC se recibe como string con la configuración
 *   predeterminada de pg. El mapper convertirá las coordenadas
 *   a números para la respuesta HTTP.
 *
 * Este tipo describe la proyección SQL que construiremos;
 * no implica que cualquier SELECT devuelva estos tipos automáticamente.
 */
export interface ProyectoRow {
  id_proyecto: string;
  id_propietario: string;

  nombre: string;
  descripcion: string;
  direccion: string;
  contratante: string;

  fecha_inicio: string;
  fecha_finalizacion: string | null;

  estado_proyecto: EstadoProyecto;

  /**
   * true: no eliminado lógicamente.
   * false: eliminado lógicamente.
   *
   * Por sí solo no determina si el proyecto está disponible:
   * también debe estar activo su propietario.
   */
  activo: boolean;

  latitud: string | null;
  longitud: string | null;
}

/**
 * Representación del proyecto en las respuestas HTTP autorizadas.
 *
 * Las fechas conservan YYYY-MM-DD porque no representan una hora.
 * Las coordenadas se entregan como números para su uso en el mapa.
 *
 * La autorización se comprueba antes de devolver esta información.
 */
export interface ProyectoResponse {
  id_proyecto: string;
  id_propietario: string;

  nombre: string;
  descripcion: string;
  direccion: string;
  contratante: string;

  fecha_inicio: string;
  fecha_finalizacion: string | null;

  estado_proyecto: EstadoProyecto;
  activo: boolean;

  latitud: number | null;
  longitud: number | null;
}