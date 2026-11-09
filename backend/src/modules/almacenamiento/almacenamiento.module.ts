import { Module } from '@nestjs/common';

import {
  AlmacenamientoService,
} from './almacenamiento.service';

import {
  AlmacenamientoLocalService,
} from './almacenamiento-local.service';

import {
  AlmacenamientoS3Service,
} from './almacenamiento-s3.service';

import {
  getAlmacenamientoProveedor,
} from './config/almacenamiento.config';

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
 * Expone una única abstracción de almacenamiento.
 *
 * En desarrollo usa el disco local por defecto. En producción se activa
 * Amazon S3 mediante STORAGE_PROVIDER=s3.
 */
@Module({
  imports: [
    DatabaseModule,
  ],
  providers: [
    ArchivosPendientesRepository,
    ArchivosPendientesService,
    ArchivosPendientesWorker,
    {
      provide: AlmacenamientoService,
      useFactory: () => {
        const proveedor = getAlmacenamientoProveedor();

        if (proveedor === 's3') {
          return new AlmacenamientoS3Service();
        }

        return new AlmacenamientoLocalService();
      },
    },
  ],
  exports: [
    AlmacenamientoService,
    ArchivosPendientesRepository,
  ],
})
export class AlmacenamientoModule {}