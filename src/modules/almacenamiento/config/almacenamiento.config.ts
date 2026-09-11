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