import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { ProyectosController } from './proyectos.controller';
import { ProyectosRepository } from './proyectos.repository';
import { ProyectosService } from './proyectos.service';

/**
 * Agrupa las rutas y los casos de uso de proyectos.
 *
 * AuthModule y UsuariosModule proporcionan las dependencias
 * que necesita AuthGuard.
 *
 * DatabaseModule mantiene el pool compartido.
 */
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsuariosModule,
  ],
  controllers: [
    ProyectosController,
  ],
  providers: [
    ProyectosRepository,
    ProyectosService,
  ],
})
export class ProyectosModule {}