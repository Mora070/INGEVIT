import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { UsuariosAdminController } from './usuarios-admin.controller';

/**
 * Conecta la autenticación con las operaciones administrativas.
 *
 * Reutiliza los servicios existentes.
 * No crea otro pool ni registra nuevamente UsuariosService.
 */
@Module({
  imports: [
    AuthModule,
    UsuariosModule,
  ],
  controllers: [
    UsuariosAdminController,
  ],
})
export class AdministracionModule {}