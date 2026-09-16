import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

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
 * Paginación del historial del usuario autenticado.
 * No admite un id_receptor proporcionado por el cliente.
 */
export class ListarNotificacionesQueryDto {
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