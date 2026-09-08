import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * Agrupa y comparte el acceso a PostgreSQL.
 *
 * Los módulos que necesiten consultar la base de datos deberán
 * importar DatabaseModule e inyectar DatabaseService.
 *
 * No deben registrar DatabaseService nuevamente en sus providers,
 * porque podrían crear instancias adicionales y otros pools.
 */
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}