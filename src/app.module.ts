import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AuthModule } from './modules/auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { AdministracionModule } from './modules/administracion/administracion.module';

import { getAuthAllowedOrigins } from './modules/auth/auth-origin.config';
import { ProyectosModule } from './modules/proyectos/proyectos.module';
import {
  AUTH_ALLOWED_ORIGINS,
  OriginGuard,
} from './modules/auth/guards/origin.guard';



/**
 * Módulo principal del backend.
 *
 * Importa la infraestructura y, posteriormente, los módulos
 * de negocio que componen la aplicación.
 */
@Module({
  imports: [DatabaseModule, UsuariosModule, AuthModule, AdministracionModule, ProyectosModule],
  controllers: [AppController],
  providers: [
  AppService,

  /**
   * Lee y valida los orígenes durante el arranque.
   * Una configuración inválida impide iniciar la aplicación.
   */
  {
    provide: AUTH_ALLOWED_ORIGINS,
    useFactory: () => getAuthAllowedOrigins(),
  },

  /**
   * Aplica la comprobación a todos los controladores.
   * No es necesario colocar @UseGuards en cada ruta.
   */
  {
    provide: APP_GUARD,
    useClass: OriginGuard,
  },
],
})
export class AppModule {}