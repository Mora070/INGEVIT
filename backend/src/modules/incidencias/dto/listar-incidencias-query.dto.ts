import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Los parámetros de URL llegan como texto.
 * Solo convierte cadenas formadas completamente por dígitos.
 */
function convertirEntero(valor: unknown): unknown {
  if (
    typeof valor === 'string' &&
    !valor.includes('\n') &&
    !valor.includes('\r') &&
    /^\d+$/.test(valor)
  ) {
    return Number(valor);
  }

  return valor;
}

/**
 * numero_pagina identifica la página del PDF.
 * pagina y limite controlan la paginación de los resultados.
 */
export class ListarIncidenciasQueryDto {
  @Transform(({ value }) => convertirEntero(value))
  @IsInt()
  @Min(1)
  @Max(2147483647)
  numero_pagina!: number;

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