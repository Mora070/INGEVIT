import { isEmail } from 'class-validator';

export interface CorreoConfig {
  host: string;
  port: number;
  secure: boolean;
  ignoreTLS: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  remitente: {
    name: string;
    address: string;
  };
}

function obtenerRemitente(env: NodeJS.ProcessEnv): CorreoConfig['remitente'] {
  const nombre = env.CORREO_REMITENTE_NOMBRE ?? '';
  const direccion = env.CORREO_REMITENTE_DIRECCION ?? '';

  if (!nombre.trim() || /[\r\n\u0000]/.test(nombre)) {
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
    name: nombre.trim(),
    address: direccion,
  };
}

export function getCorreoConfig(
  env: NodeJS.ProcessEnv = process.env,
): CorreoConfig {
  const remitente = obtenerRemitente(env);

  if (env.CORREO_PROVEEDOR === 'mailpit') {
    if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
      throw new Error('Mailpit requiere NODE_ENV=development o NODE_ENV=test.');
    }

    if (env.CORREO_SMTP_HOST !== '127.0.0.1') {
      throw new Error('Mailpit debe utilizar CORREO_SMTP_HOST=127.0.0.1.');
    }

    if (env.CORREO_SMTP_PORT !== '1025') {
      throw new Error('Mailpit debe utilizar CORREO_SMTP_PORT=1025.');
    }

    return {
      host: '127.0.0.1',
      port: 1025,
      secure: false,
      ignoreTLS: true,
      remitente,
    };
  }

  if (env.CORREO_PROVEEDOR === 'resend') {
    if (env.NODE_ENV !== 'production') {
      throw new Error('Resend requiere NODE_ENV=production.');
    }

    const apiKey = env.CORREO_SMTP_PASSWORD;

    if (
      typeof apiKey !== 'string' ||
      apiKey !== apiKey.trim() ||
      apiKey.length === 0 ||
      /[\r\n\u0000]/.test(apiKey)
    ) {
      throw new Error('CORREO_SMTP_PASSWORD no es válida.');
    }

    return {
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      ignoreTLS: false,
      auth: {
        user: 'resend',
        pass: apiKey,
      },
      remitente,
    };
  }

  throw new Error('CORREO_PROVEEDOR debe ser mailpit o resend.');
}