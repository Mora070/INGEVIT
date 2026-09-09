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

    JwtModule.registerAsync({
      useFactory: () => getAuthConfig(),
    }),

    // Registra las opciones y los contadores del limitador.
    ThrottlerModule.forRoot(getAuthRateLimitConfig()),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    ThrottlerGuard,
    AuthGuard,
    RolesGuard,
  ],

  exports: [
  AuthGuard,
  RolesGuard,
  TokenService,
],

})
export class AuthModule {}