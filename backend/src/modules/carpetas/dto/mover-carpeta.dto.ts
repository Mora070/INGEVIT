import {
  IsOptional,
  IsUUID,
} from 'class-validator';

export class MoverCarpetaDto {
  @IsOptional()
  @IsUUID()
  id_carpeta_padre?: string | null;
}