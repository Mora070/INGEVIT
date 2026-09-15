import { SubirPlanoDto } from './subir-plano.dto';

/**
 * Datos descriptivos editables de un plano.
 *
 * Ambos campos deben enviarse. La descripción puede estar vacía.
 * Hereda las validaciones de título y descripción de la subida.
 *
 * Su clase independiente permite evolucionar el contrato de edición
 * sin cambiar los controladores que lo utilizan.
 *
 * El archivo, autor, proyecto, URL y fecha no son editables aquí.
 */
export class ActualizarPlanoDto extends SubirPlanoDto {}