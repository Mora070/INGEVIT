import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  Transform,
} from 'class-transformer';

export class CrearCarpetaDto {
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

  @IsOptional()
  @IsUUID()
  id_carpeta_padre?: string | null;
}