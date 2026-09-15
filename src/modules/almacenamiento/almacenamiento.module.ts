import { Module } from '@nestjs/common';

import {
  AlmacenamientoService,
} from './almacenamiento.service';

import {
  AlmacenamientoLocalService,
} from './almacenamiento-local.service';

import {
  ArchivosPendientesRepository,
} from './archivos-pendientes.repository';

import { DatabaseModule } from '../../database/database.module';

import {
  ArchivosPendientesService,
} from './archivos-pendientes.service';

import {
  ArchivosPendientesWorker,
} from './archivos-pendientes.worker';

/**
 * Configura la implementación de almacenamiento utilizada por el backend.
 *
 * Los consumidores dependen del contrato AlmacenamientoService,
 * sin necesitar conocer si los archivos están en disco local o en S3.
 */
@Module({
  imports: [
    DatabaseModule,   // <-- aquí lo agregas
  ],
  providers: [
    AlmacenamientoLocalService,
    ArchivosPendientesRepository,
    ArchivosPendientesService,
    ArchivosPendientesWorker,
    {
      provide: AlmacenamientoService,
      useExisting: AlmacenamientoLocalService,

    },
  ],
  exports: [AlmacenamientoService, ArchivosPendientesRepository,],
})
export class AlmacenamientoModule { }