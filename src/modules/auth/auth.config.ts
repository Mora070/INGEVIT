import type { JwtModuleOptions } from '@nestjs/jwt';

/**
 * Duración inicial del token, expresada en segundos.
 * La reutilizaremos al configurar la cookie para evitar diferencias.
 */
export const AUTH_TOKEN_TTL_SECONDS = 15 * 60;

/**
 * Identificadores técnicos de quién emite el token
 * y qué API puede aceptarlo.
 */
const AUTH_TOKEN_ISSUER = 'ingevit-backend';
const AUTH_TOKEN_AUDIENCE = 'ingevit-api';

/**
 * Construye la configuración de firma y verificación.
 *
 * Recibe el entorno como argumento para poder probarla
 * sin modificar process.env.
 *
 * No incluye una clave predeterminada: una configuración
 * incompleta debe impedir el arranque al registrar el módulo.
 */
export function getAuthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): JwtModuleOptions {
  const secretHex = environment.AUTH_JWT_SECRET;

  /**
   * Exigimos la representación hexadecimal de 32 bytes.
   * Esta validación comprueba el formato, no la aleatoriedad:
   * la clave debe generarse con el comando indicado.
   */
  if (
    secretHex === undefined ||
    !/^[a-fA-F0-9]{64}$/.test(secretHex)
  ) {
    throw new Error(
      'Configuración de autenticación inválida: ' +
        'AUTH_JWT_SECRET debe contener 64 caracteres hexadecimales.',
    );
  }

  // Recupera los 32 bytes originales de la clave aleatoria.
  const secret = Buffer.from(secretHex, 'hex');

  return {
    secret,

    signOptions: {
      algorithm: 'HS256',
      expiresIn: AUTH_TOKEN_TTL_SECONDS,
      issuer: AUTH_TOKEN_ISSUER,
      audience: AUTH_TOKEN_AUDIENCE,
    },

    verifyOptions: {
      // Aceptamos únicamente el algoritmo configurado.
      algorithms: ['HS256'],
      issuer: AUTH_TOKEN_ISSUER,
      audience: AUTH_TOKEN_AUDIENCE,
      ignoreExpiration: false,
    },
  };
}