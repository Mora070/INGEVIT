import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
  Get,
  Req,
  UnauthorizedException
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
} from './auth-cookie.config';
import type { UsuarioResponse } from '../usuarios/types/usuario.types';
import { AuthGuard } from './guards/auth.guard';
import type { AuthRequest } from './types/auth-request.types';
import { RegisterDto } from './dto/register.dto';

/**
 * Expone las operaciones HTTP de autenticación.
 *
 * Delega las credenciales al servicio y administra la cookie.
 * No consulta PostgreSQL ni realiza operaciones criptográficas.
 */
@Controller('auth')
export class AuthController {
  private readonly cookieOptions: CookieOptions;

  constructor(private readonly authService: AuthService) {
    /**
     * Valida la configuración durante la creación del controlador.
     * Una configuración inválida impide arrancar la aplicación.
     */
    this.cookieOptions = getAuthCookieOptions();
  }

  /**
   * Inicia sesión mediante correo y contraseña.
   *
   * Antes de ejecutar este método:
   * - OriginGuard comprueba el origen.
   * - ThrottlerGuard limita la frecuencia de solicitudes.
   * - ValidationPipe valida y transforma LoginDto.
   *
   * El token se entrega exclusivamente mediante Set-Cookie.
   * El cuerpo de la respuesta contiene únicamente el perfil.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  async iniciarSesion(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UsuarioResponse> {
    const resultado = await this.authService.iniciarSesion(
      dto.correo,
      dto.password,
    );

    // Esta línea solo se ejecuta si la autenticación fue satisfactoria.
    response.cookie(
      AUTH_COOKIE_NAME,
      resultado.tokenAcceso,
      this.cookieOptions,
    );

    return resultado.usuario;
  }

  /**
 * Devuelve el perfil de la sesión actual.
 *
 * AuthGuard ya verificó el token y consultó el usuario en PostgreSQL.
 * Reutilizamos ese perfil para evitar una segunda consulta.
 *
 * La respuesta contiene datos personales y no debe almacenarse
 * en caché.
 */
  @Get('me')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AuthGuard)
  obtenerMiPerfil(
    @Req() request: AuthRequest,
  ): UsuarioResponse {
    const usuario = request.usuario;

    /**
     * Comprobación defensiva: nunca responder con una identidad
     * ausente si cambia la configuración de la ruta.
     */
    if (usuario === undefined) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return usuario;
  }

  /**
   * Elimina la cookie de acceso del navegador.
   *
   * No exige una sesión válida: también permite limpiar una cookie
   * vencida o inválida, o repetir la operación si ya fue eliminada.
   *
   * OriginGuard sigue comprobando el origen porque es una ruta POST.
   *
   * Esta operación no revoca copias del JWT en el servidor.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  cerrarSesion(
    @Res({ passthrough: true }) response: Response,
  ): void {
    /**
     * Conservamos las opciones de alcance y seguridad del login.
     * Copiamos el objeto para no modificar la configuración compartida.
     */
    const clearOptions = { ...this.cookieOptions };

    // La eliminación debe establecer una fecha de expiración pasada.
    delete clearOptions.maxAge;
    delete clearOptions.expires;

    response.clearCookie(AUTH_COOKIE_NAME, clearOptions);
  }

  /**
   * Crea una cuenta mediante correo y contraseña.
   *
   * Antes de ejecutar este método:
   * - OriginGuard comprueba el origen.
   * - ThrottlerGuard limita las solicitudes.
   * - ValidationPipe valida RegisterDto y rechaza campos adicionales.
   *
   * Devuelve únicamente el perfil.
   * El usuario deberá iniciar sesión mediante la ruta de login.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  async registrar(
    @Body() dto: RegisterDto,
  ): Promise<UsuarioResponse> {
    return this.authService.registrar(dto);
  }

}