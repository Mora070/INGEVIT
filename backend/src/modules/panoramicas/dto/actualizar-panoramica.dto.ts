import { SubirPanoramicaDto } from './subir-panoramica.dto';

/**
 * Permite editar únicamente el título.
 * Hereda su validación y rechaza campos adicionales mediante el pipe global.
 */
export class ActualizarPanoramicaDto extends SubirPanoramicaDto {}