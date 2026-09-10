import { CrearProyectoDto } from './crear-proyecto.dto';

/**
 * Entrada para reemplazar los datos editables de un proyecto.
 *
 * Reutiliza las validaciones de creación:
 * - Nombre, descripción, dirección y contratante obligatorios.
 * - Fecha de inicio obligatoria.
 * - Fecha de finalización opcional.
 * - Estado de trabajo explícito.
 * - Coordenadas completas o ausentes.
 *
 * Semántica de PUT:
 * Los campos opcionales omitidos se normalizarán a null.
 *
 * No admite id_propietario, activo ni colaboradores.
 * La autorización del propietario se comprobará en la transacción.
 */
export class ActualizarProyectoDto extends CrearProyectoDto {}