import type { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Configura el límite de solicitudes de inicio de sesión.
 *
 * Los tiempos se expresan en milisegundos.
 * El contador se mantiene en memoria y se reinicia con el backend.
 *
 * Este control no modifica el estado de las cuentas.
 */
export function getAuthRateLimitConfig(): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        name: 'default',
        limit: 10,
        ttl: 60_000,
        blockDuration: 60_000,
      },
    ],
    errorMessage:
      'Demasiadas solicitudes de autenticación. Inténtalo más tarde.',
  };
}