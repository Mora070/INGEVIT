import { Module } from '@nestjs/common';

import {
  AlmacenamientoService,
} from './almacenamiento.service';

import {
  AlmacenamientoLocalService,
} from './almacenamiento-local.service';

/**
 * Configura la implementación de almacenamiento utilizada por el backend.
 *
 * Los consumidores dependen del contrato AlmacenamientoService,
 * sin necesitar conocer si los archivos están en disco local o en S3.
 */
@Module({
  providers: [
    AlmacenamientoLocalService,
    {
      provide: AlmacenamientoService,
      useExisting: AlmacenamientoLocalService,
    },
  ],
  exports: [AlmacenamientoService],
})
export class AlmacenamientoModule {}