import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';

import {
  FotografiasConsultaRepository,
} from './fotografias-consulta.repository';

import { FotografiasService } from './fotografias.service';

/**
 * Agrupa las dependencias de fotografías.
 *
 * El repositorio de consulta permanece interno al módulo.
 * Otros módulos acceden a la funcionalidad mediante FotografiasService.
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    FotografiasConsultaRepository,
    FotografiasService,
  ],
  exports: [FotografiasService],
})
export class FotografiasModule {}