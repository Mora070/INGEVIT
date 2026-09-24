import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/** Convierte únicamente parámetros de URL formados por dígitos. */
function convertirEntero(valor: unknown): unknown {
  if (
    typeof valor === 'string'
    && !valor.includes('\n')
    && !valor.includes('\r')
    && /^\d+$/.test(valor)
  ) {
    return Number(valor);
  }

  return valor;
}

/**
 * Paginación de incidencias creadas directamente en el mapa.
 * No recibe plano ni número de página de un documento.
 */
export class ListarIncidenciasMapaQueryDto {
  @Transform(({ value }) => convertirEntero(value))
  @IsInt()
  @Min(1)
  @Max(2147483647)
  pagina: number = 1;

  @Transform(({ value }) => convertirEntero(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 50;
}