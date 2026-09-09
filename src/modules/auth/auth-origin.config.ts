/**
 * Obtiene los orígenes autorizados para las solicitudes del navegador.
 *
 * Un origen contiene únicamente:
 * - Protocolo.
 * - Host.
 * - Puerto, cuando no es el predeterminado.
 *
 * No admite rutas, credenciales, parámetros ni fragmentos.
 */
export function getAuthAllowedOrigins(
  environment: NodeJS.ProcessEnv = process.env,
): ReadonlySet<string> {
  const configuredOrigins = environment.AUTH_ALLOWED_ORIGINS;

  if (
    configuredOrigins === undefined ||
    configuredOrigins.trim() === ''
  ) {
    throw new Error(
      'Configuración de origen incompleta: falta AUTH_ALLOWED_ORIGINS.',
    );
  }

  const allowedOrigins = new Set<string>();

  for (const entry of configuredOrigins.split(',')) {
    const origin = entry.trim();

    let parsedOrigin: URL;

    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error(
        'AUTH_ALLOWED_ORIGINS contiene un origen inválido.',
      );
    }

    /**
     * Exigimos un origen HTTP/HTTPS en su representación canónica.
     *
     * La igualdad exacta rechaza, entre otros:
     * - Una barra final o una ruta.
     * - Credenciales dentro de la URL.
     * - Parámetros o fragmentos.
     * - El comodín "*".
     *
     * No utilizaremos coincidencias parciales de dominios.
     */
    const isHttp =
      parsedOrigin.protocol === 'http:' ||
      parsedOrigin.protocol === 'https:';

    if (!isHttp || parsedOrigin.origin !== origin) {
      throw new Error(
        'AUTH_ALLOWED_ORIGINS debe contener orígenes HTTP/HTTPS ' +
          'exactos, sin rutas ni barra final.',
      );
    }

    if (
      environment.NODE_ENV === 'production' &&
      parsedOrigin.protocol !== 'https:'
    ) {
      throw new Error(
        'Los orígenes permitidos deben utilizar HTTPS en producción.',
      );
    }

    allowedOrigins.add(origin);
  }

  return allowedOrigins;
}