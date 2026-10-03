import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  Transform,
} from 'class-transformer';

export class ActualizarCarpetaDto {
  @Transform(
    ({
      value,
    }) =>
      typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nombre!: string;
}