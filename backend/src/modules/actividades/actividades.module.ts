import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';

import { ActividadesRepository } from './actividades.repository';
import {
  ActividadesConsultaRepository,
} from './actividades-consulta.repository';
import { ActividadesService } from './actividades.service';

/**
 * Agrupa la escritura y la consulta del historial.
 *
 * ActividadesRepository recibe el cliente de transacción del servicio
 * que realiza la modificación del proyecto.
 *
 * ActividadesConsultaRepository utiliza DatabaseService para consultar
 * el historial y comprobar el acceso en una misma sentencia.
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    ActividadesRepository,
    ActividadesConsultaRepository,
    ActividadesService,
  ],
  exports: [
    ActividadesRepository,
    ActividadesService,
  ],
})
export class ActividadesModule {}