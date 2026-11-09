import {
  isAbsolute,
  normalize,
  parse,
} from 'node:path';

export interface AlmacenamientoLocalConfig {
  directorioRaiz: string;
}

/**
 * Obtiene y valida la configuración del almacenamiento local.
 *
 * Exige una ruta absoluta para que la ubicación no dependa de la carpeta
 * desde la cual se inicie el proceso.
 *
 * Esta función no crea carpetas ni comprueba permisos de escritura.
 * Esa comprobación corresponderá a la implementación del almacenamiento.
 */
export function getAlmacenamientoLocalConfig(
  env: NodeJS.ProcessEnv = process.env,
): AlmacenamientoLocalConfig {
  const valor = env.STORAGE_LOCAL_ROOT;

  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new Error(
      'La variable STORAGE_LOCAL_ROOT es obligatoria.',
    );
  }

  if (valor !== valor.trim()) {
    throw new Error(
      'STORAGE_LOCAL_ROOT no debe tener espacios al inicio o al final.',
    );
  }

  if (valor.includes('\0')) {
    throw new Error(
      'STORAGE_LOCAL_ROOT contiene un carácter no permitido.',
    );
  }

  if (!isAbsolute(valor)) {
    throw new Error(
      'STORAGE_LOCAL_ROOT debe ser una ruta absoluta.',
    );
  }

  const directorioRaiz = normalize(valor);

  // Evita configurar una unidad completa como carpeta de almacenamiento.
  if (directorioRaiz === parse(directorioRaiz).root) {
    throw new Error(
      'STORAGE_LOCAL_ROOT debe indicar una carpeta, no la raíz del sistema de archivos.',
    );
  }

  return {
    directorioRaiz,
  };
}

export type AlmacenamientoProveedor = 'local' | 's3';

export interface AlmacenamientoS3Config {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function getAlmacenamientoProveedor(
  env: NodeJS.ProcessEnv = process.env,
): AlmacenamientoProveedor {
  const proveedor = env.STORAGE_PROVIDER ?? 'local';

  if (proveedor === 'local' || proveedor === 's3') {
    return proveedor;
  }

  throw new Error(
    'STORAGE_PROVIDER debe ser "local" o "s3".',
  );
}

export function getAlmacenamientoS3Config(
  env: NodeJS.ProcessEnv = process.env,
): AlmacenamientoS3Config {
  const obtenerRequerida = (nombre: string): string => {
    const valor = env[nombre];

    if (typeof valor !== 'string' || valor.trim() === '') {
      throw new Error(
        `${nombre} es obligatoria cuando STORAGE_PROVIDER=s3.`,
      );
    }

    if (valor !== valor.trim()) {
      throw new Error(
        `${nombre} no debe tener espacios al inicio o al final.`,
      );
    }

    return valor;
  };

  const region = obtenerRequerida('AWS_REGION');
  const bucket = obtenerRequerida('AWS_S3_BUCKET');

  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error('AWS_S3_BUCKET no tiene un nombre válido.');
  }

  return {
    region,
    bucket,
    accessKeyId: obtenerRequerida('AWS_ACCESS_KEY_ID'),
    secretAccessKey: obtenerRequerida('AWS_SECRET_ACCESS_KEY'),
  };
}