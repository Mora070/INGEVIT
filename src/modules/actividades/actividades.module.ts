import { Module } from '@nestjs/common';

import { ActividadesRepository } from './actividades.repository';

/**
 * Proporciona la escritura del historial a otros módulos.
 *
 * No importa DatabaseModule porque el repositorio utiliza
 * exclusivamente la conexión transaccional que recibe.
 */
@Module({
  providers: [ActividadesRepository],
  exports: [ActividadesRepository],
})
export class ActividadesModule {}