import { Transform } from 'class-transformer';

import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function convertirEnteroDeConsulta(
  valor: unknown,
): unknown {
  if (
    typeof valor === 'string' &&
    /^[0-9]+$/.test(valor)
  ) {
    return Number(valor);
  }

  return valor;
}

function normalizarCorreo(
  valor: unknown,
): unknown {
  if (
    typeof valor === 'string'
  ) {
    return valor.trim();
  }

  return valor;
}

export class ListarUsuariosColaboradoresQueryDto {
  @IsOptional()
  @Transform(
    ({
      value,
    }: {
      value: unknown;
    }) =>
      normalizarCorreo(
        value,
      ),
  )
  @IsString({
    message:
      'La búsqueda por correo debe ser una cadena de texto.',
  })
  @MaxLength(254, {
    message:
      'La búsqueda por correo no puede superar 254 caracteres.',
  })
  correo?: string;

  @Transform(
    ({
      value,
    }: {
      value: unknown;
    }) =>
      convertirEnteroDeConsulta(
        value,
      ),
  )
  @IsInt({
    message:
      'La página debe ser un número entero.',
  })
  @Min(1, {
    message:
      'La página debe ser mayor o igual a 1.',
  })
  @Max(
    2_147_483_647,
    {
      message:
        'La página es demasiado grande.',
    },
  )
  pagina: number = 1;

  @Transform(
    ({
      value,
    }: {
      value: unknown;
    }) =>
      convertirEnteroDeConsulta(
        value,
      ),
  )
  @IsInt({
    message:
      'El límite debe ser un número entero.',
  })
  @Min(1, {
    message:
      'El límite debe ser mayor o igual a 1.',
  })
  @Max(50, {
    message:
      'El límite no puede superar 50 usuarios.',
  })
  limite: number = 20;
}