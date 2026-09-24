import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

function convertirEntero(valor: unknown): unknown {
  if (
    typeof valor === 'string'
    && valor.trim() === valor
    && /^\d+$/.test(valor)
  ) {
    return Number(valor);
  }

  return valor;
}

/** Paginación del listado compartido de capas del proyecto. */
export class ListarCapasQueryDto {
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