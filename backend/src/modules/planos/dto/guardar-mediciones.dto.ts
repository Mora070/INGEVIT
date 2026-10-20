import { IsInt, IsObject, Max, Min } from 'class-validator';

export class GuardarMedicionesDto {
  @IsInt()
  @Min(0)
  @Max(2147483646)
  version!: number;

  @IsObject()
  estado!: Record<string, unknown>;
}
