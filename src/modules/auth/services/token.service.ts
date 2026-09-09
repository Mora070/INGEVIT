import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  JsonWebTokenError,
  JwtService,
} from '@nestjs/jwt';

/**
 * Comprueba la representación estándar de un UUID.
 *
 * No restringimos la versión del UUID.
 * Esta comprobación valida su formato, no la existencia del usuario.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Centraliza la emisión y verificación de tokens de acceso.
 *
 * No consulta PostgreSQL ni comprueba permisos.
 * Los tokens son credenciales y nunca deben registrarse en logs.
 */
@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * Emite un token para una identidad previamente autenticada.
   *
   * JwtModule proporciona el algoritmo, vencimiento,
   * emisor y destinatario.
   */
  async emitirToken(idUsuario: string): Promise<string> {
    return this.jwtService.signAsync({
      sub: idUsuario,
    });
  }

  /**
   * Verifica el token y devuelve el UUID de su sujeto.
   *
   * La verificación criptográfica no comprueba que la cuenta
   * todavía exista o esté activa. El guard consultará esos datos.
   *
   * Un token inválido produce un error de autenticación genérico.
   * Otros fallos técnicos se propagan.
   */
  async verificarToken(token: string): Promise<string> {
    let payload: unknown;

    try {
      /**
       * Aplica las opciones de verificación de JwtModule:
       * - Firma y algoritmo permitido.
       * - Vencimiento.
       * - Emisor.
       * - Destinatario.
       *
       * Usamos unknown porque el contenido requiere validación
       * en tiempo de ejecución, aunque la firma sea correcta.
       */
      payload = await this.jwtService.verifyAsync(token);
    } catch (error: unknown) {
      /**
       * Los errores de expiración y de activación futura también
       * pertenecen a la familia JsonWebTokenError.
       *
       * No exponemos al cliente los detalles criptográficos.
       */
      if (error instanceof JsonWebTokenError) {
        throw new UnauthorizedException(
          'La sesión no es válida o ha expirado.',
        );
      }

      throw error;
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload)
    ) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    const claims = payload as Record<string, unknown>;

    /**
     * Además de verificar el token, exigimos nuestro contrato:
     * - sub: UUID del usuario.
     * - iat: instante de emisión.
     * - exp: instante de vencimiento posterior a la emisión.
     *
     * Los timestamps JWT se expresan en segundos.
     * Exigimos exp explícitamente para rechazar tokens sin vencimiento.
     */
    if (
      typeof claims.sub !== 'string' ||
      !UUID_PATTERN.test(claims.sub) ||
      typeof claims.iat !== 'number' ||
      !Number.isSafeInteger(claims.iat) ||
      typeof claims.exp !== 'number' ||
      !Number.isSafeInteger(claims.exp) ||
      claims.exp <= claims.iat
    ) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return claims.sub;
  }
}