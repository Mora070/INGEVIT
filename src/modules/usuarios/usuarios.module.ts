import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { UsuariosRepository } from './usuarios.repository';
import { UsuariosService } from './usuarios.service';

/**
 * Agrupa la gestión de usuarios.
 *
 * Comparte el servicio con otros módulos, manteniendo el repositorio
 * como detalle interno de acceso a datos.
 *
 * Todavía no expone rutas HTTP.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [],
  providers: [UsuariosRepository, UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}