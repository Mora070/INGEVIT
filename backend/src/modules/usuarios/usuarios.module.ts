import {
  forwardRef,
  Module,
} from '@nestjs/common';

import {
  DatabaseModule,
} from '../../database/database.module';

import {
  AuthModule,
} from '../auth/auth.module';

import {
  UsuariosController,
} from './usuarios.controller';

import {
  UsuariosRepository,
} from './usuarios.repository';

import {
  UsuariosService,
} from './usuarios.service';

/**
 * Agrupa la gestión de usuarios.
 *
 * Expone:
 * - Operaciones HTTP generales de usuarios autenticados.
 * - El servicio para reutilización desde otros módulos.
 *
 * El repositorio permanece como detalle interno
 * de acceso a PostgreSQL.
 *
 * forwardRef resuelve la dependencia circular:
 *
 * - AuthModule necesita UsuariosModule porque
 *   AuthGuard utiliza UsuariosService.
 *
 * - UsuariosModule necesita AuthModule porque
 *   UsuariosController utiliza AuthGuard.
 */
@Module({
  imports: [
    DatabaseModule,

    forwardRef(
      () =>
        AuthModule,
    ),
  ],

  controllers: [
    UsuariosController,
  ],

  providers: [
    UsuariosRepository,
    UsuariosService,
  ],

  exports: [
    UsuariosService,
  ],
})
export class UsuariosModule {}