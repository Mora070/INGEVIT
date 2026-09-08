import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';

/**
 * Módulo principal del backend.
 *
 * Importa la infraestructura y, posteriormente, los módulos
 * de negocio que componen la aplicación.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}