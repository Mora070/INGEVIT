import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import {
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';

import { UsuariosModule } from '../usuarios/usuarios.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { getAuthConfig } from './auth.config';
import { getAuthRateLimitConfig } from './auth-rate-limit.config';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';



import {
  CambiarPasswordController,
} from './cambiar-password.controller';

import {
  CambiarPasswordService,
} from './services/cambiar-password.service';

import { DatabaseModule } from '../../database/database.module';
import { CorreosModule } from '../correos/correos.module';

import {
  RecuperacionPasswordController,
} from './recuperacion-password.controller';

import {
  RecuperacionCodigoRepository,
} from './recuperacion-codigo.repository';

import {
  RecuperacionPasswordService,
} from './services/recuperacion-password.service';


import { GoogleAuthController } from './google-auth.controller';
import { GoogleCuentasRepository } from './google-cuentas.repository';
import { GoogleAuthService } from './services/google-auth.service';
import {
  GoogleIdentidadService,
} from './services/google-identidad.service';
import {
  VERIFICADOR_GOOGLE,
  crearVerificadorGoogle,
} from './google-verificador';

import { RecuperacionColaRepository } from './recuperacion-cola.repository';
import { RecuperacionColaWorker } from './recuperacion-cola.worker';
import {
  RecuperacionSolicitudesService,
} from './services/recuperacion-solicitudes.service';

/**
 * Agrupa los componentes de autenticación y sus dependencias.
 *
 * JwtModule proporciona la firma y verificación de tokens.
 * ThrottlerModule proporciona la configuración y el almacenamiento
 * que necesita ThrottlerGuard para limitar las solicitudes.
 */
@Module({
  imports: [
    UsuariosModule,
    DatabaseModule,
    CorreosModule,

    JwtModule.registerAsync({
      useFactory: () => getAuthConfig(),
    }),

    // Registra las opciones y los contadores del limitador.
    ThrottlerModule.forRoot(getAuthRateLimitConfig()),
  ],

  controllers: [
    AuthController,
    CambiarPasswordController,
    RecuperacionPasswordController,
    GoogleAuthController,
  ],

  providers: [
    AuthService,
    PasswordService,
    TokenService,
    ThrottlerGuard,
    AuthGuard,
    RolesGuard,
    CambiarPasswordService,
    RecuperacionCodigoRepository,
    RecuperacionPasswordService,
    GoogleCuentasRepository,
    GoogleIdentidadService,
    GoogleAuthService,
    RecuperacionColaRepository,
    RecuperacionSolicitudesService,
    RecuperacionColaWorker,
    {
      provide: VERIFICADOR_GOOGLE,
      useFactory: crearVerificadorGoogle,
    },
  ],

  exports: [
    AuthGuard,
    RolesGuard,
    TokenService,
  ],
})
export class AuthModule { }