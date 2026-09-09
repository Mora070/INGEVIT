import type {
  ProyectoResponse,
  ProyectoRow,
} from '../types/proyecto.types';

/**
 * Convierte una coordenada NUMERIC recibida como texto.
 *
 * Los valores ausentes se conservan como null.
 * Un valor inesperado produce un error técnico, evitando devolver
 * coordenadas inválidas o convertir una cadena vacía en cero.
 */
function convertirCoordenada(
  valor: string | null,
  minimo: number,
  maximo: number,
): number | null {
  if (valor === null) {
    return null;
  }

  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new Error(
      'El proyecto contiene una coordenada con formato inválido.',
    );
  }

  const coordenada = Number(valor);

  if (
    !Number.isFinite(coordenada) ||
    coordenada < minimo ||
    coordenada > maximo
  ) {
    throw new Error(
      'El proyecto contiene una coordenada fuera del rango permitido.',
    );
  }

  return coordenada;
}

/**
 * Construye la representación HTTP de un proyecto.
 *
 * Responsabilidades:
 * - Seleccionar explícitamente los campos de salida.
 * - Convertir las coordenadas a números.
 * - Conservar las fechas de calendario como YYYY-MM-DD.
 * - No modificar la fila recibida.
 *
 * No consulta usuarios ni determina permisos o disponibilidad.
 */
export function toProyectoResponse(
  proyecto: ProyectoRow,
): ProyectoResponse {
  /**
   * Refleja la restricción existente en PostgreSQL:
   * ambas coordenadas deben estar presentes o ambas ser null.
   */
  if (
    (proyecto.latitud === null) !==
    (proyecto.longitud === null)
  ) {
    throw new Error(
      'El proyecto contiene una ubicación incompleta.',
    );
  }

  return {
    id_proyecto: proyecto.id_proyecto,
    id_propietario: proyecto.id_propietario,
    nombre: proyecto.nombre,
    descripcion: proyecto.descripcion,
    direccion: proyecto.direccion,
    contratante: proyecto.contratante,
    fecha_inicio: proyecto.fecha_inicio,
    fecha_finalizacion: proyecto.fecha_finalizacion,
    estado_proyecto: proyecto.estado_proyecto,
    activo: proyecto.activo,
    latitud: convertirCoordenada(proyecto.latitud, -90, 90),
    longitud: convertirCoordenada(proyecto.longitud, -180, 180),
  };
}