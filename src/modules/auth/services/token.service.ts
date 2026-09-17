import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  JsonWebTokenError,
  JwtService,
} from '@nestjs/jwt';

import type { IdentidadSesion } from '../types/identidad-sesion.types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esVersionSesion(valor: unknown): valor is number {
  return (
    typeof valor === 'number' &&
    Number.isInteger(valor) &&
    valor >= 0 &&
    valor <= 2_147_483_647
  );
}

/**
 * Centraliza la emisión y verificación criptográfica de tokens.
 *
 * No consulta PostgreSQL. El guard debe comprobar la existencia,
 * el estado y la versión actual de la cuenta.
 *
 * Los tokens nunca deben registrarse en logs.
 */
@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * Método temporal de compatibilidad.
   * Se retirará al migrar el login al contrato versionado.
   
  async emitirToken(idUsuario: string): Promise<string> {
    return this.jwtService.signAsync({
      sub: idUsuario,
    });
  }
*/

  /**
   * Método temporal de compatibilidad.
   * Se retirará al migrar el guard al contrato versionado.
   
  async verificarToken(token: string): Promise<string> {
    const claims = await this.verificarClaims(token);
    return claims.sub as string;
  }
*/
  /**
   * Emite un token con la versión obtenida del almacenamiento interno.
   *
   * No debe recibirse esta versión desde una petición HTTP.
   */
  async emitirTokenConVersion(
    idUsuario: string,
    versionSesion: number,
  ): Promise<string> {
    if (
      typeof idUsuario !== 'string' ||
      idUsuario.length !== 36 ||
      !UUID_PATTERN.test(idUsuario) ||
      !esVersionSesion(versionSesion)
    ) {
      throw new Error(
        'La identidad interna para emitir el token no es válida.',
      );
    }

    return this.jwtService.signAsync({
      sub: idUsuario,
      version_sesion: versionSesion,
    });
  }

  /**
   * Verifica la firma y exige el contrato versionado.
   *
   * Un token sin versión se rechaza: no se le asigna cero
   * ni se intenta interpretarlo como un token antiguo.
   */
  async verificarTokenConVersion(
    token: string,
  ): Promise<IdentidadSesion> {
    const claims = await this.verificarClaims(token);

    if (!esVersionSesion(claims.version_sesion)) {
      throw this.sesionInvalida();
    }

    return {
      id_usuario: claims.sub as string,
      version_sesion: claims.version_sesion,
    };
  }

  /**
   * Comparte la validación criptográfica y estructural.
   * Cada llamada verifica el token una sola vez.
   */
  private async verificarClaims(
    token: string,
  ): Promise<Record<string, unknown>> {
    let payload: unknown;

    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch (error: unknown) {
      if (error instanceof JsonWebTokenError) {
        throw this.sesionInvalida();
      }

      throw error;
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload)
    ) {
      throw this.sesionInvalida();
    }

    const claims = payload as Record<string, unknown>;

    if (
      typeof claims.sub !== 'string' ||
      claims.sub.length !== 36 ||
      !UUID_PATTERN.test(claims.sub) ||
      typeof claims.iat !== 'number' ||
      !Number.isSafeInteger(claims.iat) ||
      typeof claims.exp !== 'number' ||
      !Number.isSafeInteger(claims.exp) ||
      claims.exp <= claims.iat
    ) {
      throw this.sesionInvalida();
    }

    return claims;
  }

  private sesionInvalida(): UnauthorizedException {
    return new UnauthorizedException(
      'La sesión no es válida o ha expirado.',
    );
  }
}