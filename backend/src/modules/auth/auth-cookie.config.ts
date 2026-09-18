import type { CookieOptions } from 'express';

import { AUTH_TOKEN_TTL_SECONDS } from './auth.config';

/**
 * Nombre compartido por la emisión, lectura y eliminación
 * de la cookie de acceso.
 */
export const AUTH_COOKIE_NAME = 'ingevit_access_token';

/**
 * Construye las opciones de la cookie de autenticación.
 *
 * Recibe el entorno explícitamente para facilitar las pruebas.
 * No lee ni modifica el token.
 *
 * La configuración se valida cuando se ejecuta esta función.
 */
export function getAuthCookieOptions(
  environment: NodeJS.ProcessEnv = process.env,
): CookieOptions {
  const nodeEnv = environment.NODE_ENV;

  /**
   * Exigimos un entorno reconocido para evitar que un error
   * de escritura desactive silenciosamente la opción Secure.
   */
  if (
    nodeEnv !== 'development' &&
    nodeEnv !== 'test' &&
    nodeEnv !== 'production'
  ) {
    throw new Error(
      'Configuración de cookies inválida: NODE_ENV debe ser ' +
        'development, test o production.',
    );
  }

  return {
    /**
     * Impide que JavaScript del navegador lea la cookie.
     * El navegador puede enviarla automáticamente en las solicitudes.
     */
    httpOnly: true,

    /**
     * En producción exige HTTPS.
     * En desarrollo y pruebas permite nuestro servidor HTTP local.
     */
    secure: nodeEnv === 'production',

    /**
     * Restringe el envío de la cookie en solicitudes entre sitios.
     * Complementaremos esta medida con controles de origen
     * antes de exponer las operaciones autenticadas.
     */
    sameSite: 'strict',

    /**
     * Permite utilizar la cookie en las rutas de la aplicación.
     * No definimos Domain: queda asociada al host que la establece.
     */
    path: '/',

    /**
     * Express recibe maxAge en milisegundos.
     * Reutilizamos la duración del JWT, definida en segundos.
     *
     * El backend siempre verificará el vencimiento del token,
     * independientemente de que el navegador conserve la cookie.
     */
    maxAge: AUTH_TOKEN_TTL_SECONDS * 1_000,
  };
}