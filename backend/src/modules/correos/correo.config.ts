import { isEmail } from 'class-validator';

export interface CorreoConfig {
  host: string;
  port: number;
  remitente: {
    name: string;
    address: string;
  };
}

/**
 * Obtiene la configuración del proveedor local.
 *
 * Por ahora únicamente admitimos Mailpit en desarrollo y pruebas.
 * La configuración de producción se incorporará cuando se elija
 * el proveedor y sus requisitos de autenticación y cifrado.
 *
 * Recibir las variables como argumento permite probar esta función
 * sin modificar process.env.
 */
export function getCorreoConfig(
  env: NodeJS.ProcessEnv = process.env,
): CorreoConfig {
  if (
    env.NODE_ENV !== 'development' &&
    env.NODE_ENV !== 'test'
  ) {
    throw new Error(
      'Mailpit requiere NODE_ENV=development o NODE_ENV=test.',
    );
  }

  if (env.CORREO_PROVEEDOR !== 'mailpit') {
    throw new Error('CORREO_PROVEEDOR debe ser mailpit.');
  }

  // Coincide con la dirección local donde iniciamos Mailpit.
  if (env.CORREO_SMTP_HOST !== '127.0.0.1') {
    throw new Error(
      'Mailpit debe utilizar CORREO_SMTP_HOST=127.0.0.1.',
    );
  }

  const puertoTexto = env.CORREO_SMTP_PORT ?? '';

  if (!/^[0-9]+$/.test(puertoTexto)) {
    throw new Error('CORREO_SMTP_PORT debe ser un puerto válido.');
  }

  const port = Number(puertoTexto);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('CORREO_SMTP_PORT debe estar entre 1 y 65535.');
  }

  const nombre = env.CORREO_REMITENTE_NOMBRE ?? '';
  const direccion = env.CORREO_REMITENTE_DIRECCION ?? '';

  if (
    !nombre.trim() ||
    /[\r\n\u0000]/.test(nombre)
  ) {
    throw new Error('CORREO_REMITENTE_NOMBRE no es válido.');
  }

  if (
    direccion !== direccion.trim() ||
    /[\r\n\u0000]/.test(direccion) ||
    !isEmail(direccion)
  ) {
    throw new Error('CORREO_REMITENTE_DIRECCION no es válida.');
  }

  return {
    host: env.CORREO_SMTP_HOST,
    port,
    remitente: {
      name: nombre.trim(),
      address: direccion,
    },
  };
}