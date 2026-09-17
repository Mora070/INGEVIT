import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';

import { AuthGuard } from './guards/auth.guard';
import type { AuthRequest } from './types/auth-request.types';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import {
  CambiarPasswordService,
} from './services/cambiar-password.service';
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
} from './auth-cookie.config';

/**
 * Expone el cambio de contraseña de la sesión actual.
 *
 * OriginGuard se aplica globalmente.
 * ThrottlerGuard limita las solicitudes antes de consultar la sesión.
 * AuthGuard verifica el token, el estado y la versión de la cuenta.
 */
@Controller('auth')
export class CambiarPasswordController {
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly cambios: CambiarPasswordService,
  ) {
    this.cookieOptions = getAuthCookieOptions();
  }

  /**
   * Cambia la contraseña y elimina la cookie del navegador.
   *
   * La actualización del hash incrementa version_sesion, por lo que
   * también quedan invalidados los tokens anteriores de otros clientes.
   *
   * La cookie solo se elimina después de confirmar el cambio.
   * No se emite automáticamente una nueva sesión.
   */
  @Post('cambiar-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard, AuthGuard)
  async cambiar(
    @Req() request: AuthRequest,
    @Body() datos: CambiarPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    await this.cambios.cambiar(
      usuario.id_usuario,
      datos,
    );

    // Conserva el alcance y los atributos de la cookie del login.
    // maxAge no debe trasladarse a la operación de eliminación.
    const opciones = { ...this.cookieOptions };
    delete opciones.maxAge;
    delete opciones.expires;

    response.clearCookie(AUTH_COOKIE_NAME, opciones);
  }
}