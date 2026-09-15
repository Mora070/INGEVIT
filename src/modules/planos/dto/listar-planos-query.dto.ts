import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

function convertirEntero(valor: unknown): unknown {
  if (
    typeof valor === 'string' &&
    /^[0-9]+$/.test(valor) &&
    !valor.includes('\n')
  ) {
    return Number(valor);
  }

  return valor;
}

/**
 * Paginación del listado de planos.
 * Los campos adicionales se rechazan mediante el ValidationPipe global.
 */
export class ListarPlanosQueryDto {
  @Transform(({ value }) => convertirEntero(value))
  @IsInt()
  @Min(1)
  @Max(2147483647)
  pagina: number = 1;

  @Transform(({ value }) => convertirEntero(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 20;
}