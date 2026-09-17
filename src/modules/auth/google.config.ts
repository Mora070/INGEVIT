/**
 * Identificador del cliente web autorizado para iniciar sesión.
 * Se valida al construir el servicio.
 */
export function getGoogleClientId(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const clientId = environment.AUTH_GOOGLE_CLIENT_ID;

  if (
    typeof clientId !== 'string' ||
    clientId.length > 255 ||
    !/^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId) ||
    clientId !== clientId.trim()
  ) {
    throw new Error(
      'AUTH_GOOGLE_CLIENT_ID debe contener el identificador del cliente web de Google.',
    );
  }

  return clientId;
}