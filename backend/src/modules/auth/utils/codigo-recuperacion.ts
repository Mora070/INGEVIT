import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const MAX_INTENTOS_RECUPERACION = 5;
export const DURACION_RECUPERACION_SEGUNDOS = 15 * 60;

/**
 * Genera ocho dígitos mediante un generador criptográfico.
 * Es texto para conservar los ceros iniciales.
 */
export function generarCodigoRecuperacion(): string {
  return randomInt(0, 100_000_000).toString().padStart(8, '0');
}

export function esCodigoRecuperacion(codigo: unknown): codigo is string {
  return (
    typeof codigo === 'string' &&
    codigo.length === 8 &&
    /^[0-9]{8}$/.test(codigo)
  );
}

/**
 * Se utiliza una clave independiente de los JWT.
 * Cambiarla invalida los códigos pendientes.
 */
export function getRecuperacionSecret(
  environment: NodeJS.ProcessEnv = process.env,
): Buffer {
  const valor = environment.AUTH_RECUPERACION_SECRET;

  if (
    typeof valor !== 'string' ||
    valor.length !== 64 ||
    !/^[0-9a-fA-F]{64}$/.test(valor)
  ) {
    throw new Error(
      'AUTH_RECUPERACION_SECRET debe contener 64 caracteres hexadecimales.',
    );
  }

  return Buffer.from(valor, 'hex');
}

/**
 * Vincula el código a la identidad interna de la cuenta.
 *
 * HMAC impide comprobar todas las combinaciones solamente con una
 * copia de la base de datos: también sería necesaria la clave secreta.
 */
export function protegerCodigoRecuperacion(
  idUsuario: string,
  codigo: string,
  secreto: Buffer,
): string {
  if (!esCodigoRecuperacion(codigo)) {
    throw new Error('El código debe contener exactamente ocho dígitos.');
  }

  if (!Buffer.isBuffer(secreto) || secreto.length !== 32) {
    throw new Error('La clave de protección de recuperación no es válida.');
  }

  return createHmac('sha256', secreto)
    .update(`recuperacion-password:${idUsuario}:${codigo}`, 'utf8')
    .digest('hex');
}

export function coincidenHashesRecuperacion(
  calculado: string,
  almacenado: string,
): boolean {
  const patron = /^[0-9a-f]{64}$/;

  if (
    calculado.length !== 64 ||
    almacenado.length !== 64 ||
    !patron.test(calculado) ||
    !patron.test(almacenado)
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(calculado, 'hex'),
    Buffer.from(almacenado, 'hex'),
  );
}