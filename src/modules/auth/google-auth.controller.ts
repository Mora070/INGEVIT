import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';

import { GoogleLoginDto } from './dto/google-login.dto';
import { GoogleAuthService } from './services/google-auth.service';
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
} from './auth-cookie.config';
import type { UsuarioResponse } from '../usuarios/types/usuario.types';

/**
 * Recibe la credencial del botón de Google.
 *
 * El OriginGuard global comprueba el origen.
 * El limitador se ejecuta antes de contactar con Google.
 * La sesión se entrega únicamente mediante una cookie HttpOnly.
 */
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class GoogleAuthController {
  private readonly cookieOptions = getAuthCookieOptions();

  constructor(
    private readonly google: GoogleAuthService,
  ) {}

  @Post('google')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async iniciarSesion(
    @Body() datos: GoogleLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UsuarioResponse> {
    const resultado = await this.google.iniciarSesion(datos.credential);

    response.cookie(
      AUTH_COOKIE_NAME,
      resultado.tokenAcceso,
      this.cookieOptions,
    );

    return resultado.usuario;
  }
}