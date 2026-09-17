import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import type { TokenPayload } from 'google-auth-library';

export const VERIFICADOR_GOOGLE = Symbol('VERIFICADOR_GOOGLE');

export interface VerificadorGoogle {
  verificar(
    credential: string,
    clientId: string,
  ): Promise<TokenPayload | undefined>;
}

/**
 * Mantiene el cliente para reutilizar su caché de certificados.
 * Separa los errores de comunicación de los errores de credencial.
 */
export function crearVerificadorGoogle(): VerificadorGoogle {
  const client = new OAuth2Client();

  return {
    async verificar(credential, clientId) {
      /*
       * Obtener certificados es una operación externa.
       * Un fallo aquí no demuestra que la credencial sea incorrecta.
       */
      const certificados = await client.getFederatedSignonCertsAsync()
        .catch(() => {
          throw new ServiceUnavailableException(
            'No se pudo contactar con Google. Inténtalo más tarde.',
          );
        });

      try {
        /*
         * Usa la verificación criptográfica de la biblioteca oficial.
         * Se indican explícitamente destinatario y emisores permitidos.
         */
        const ticket = await client.verifySignedJwtWithCertsAsync(
          credential,
          certificados.certs,
          clientId,
          ['accounts.google.com', 'https://accounts.google.com'],
        );

        return ticket.getPayload();
      } catch {
        /*
         * Algunos errores de la biblioteca incluyen el token original.
         * No los propagamos ni registramos.
         */
        throw new UnauthorizedException(
          'No se pudo validar la identidad de Google.',
        );
      }
    },
  };
}