import {
  IsIn,
  IsUUID,
} from 'class-validator';

import type {
  TipoRecursoCarpeta,
} from '../types/carpeta.types';

export class AgregarRecursoCarpetaDto {
  @IsIn([
    'FOTOGRAFIA',
    'PANORAMICA',
    'PLANO',
  ])
  tipo!: TipoRecursoCarpeta;

  @IsUUID()
  id_recurso!: string;
}