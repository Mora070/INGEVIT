import { randomUUID } from 'node:crypto';

import {
  validarClaveAlmacenamiento,
} from '../../almacenamiento/utils/validar-clave-almacenamiento';

import {
  FORMATOS_FOTOGRAFIA_ORIGINAL,
  FORMATO_FOTOGRAFIA_OPTIMIZADA,
} from '../config/procesamiento-fotografia.config';

import type {
  FormatoFotografiaOriginal,
} from '../config/procesamiento-fotografia.config';

/**
 * Referencias internas de las dos versiones de una fotografía.
 *
 * Se corresponden con las columnas existentes de PostgreSQL.
 * No representan URLs públicas.
 */
export interface ClavesFotografia {
  original_s3_key: string;
  s3_key: string;
}

/**
 * Genera claves a partir del formato detectado en el original.
 *
 * Nunca utiliza el nombre original ni el MIME declarado por el cliente.
 * La versión optimizada utiliza la extensión de su formato de salida.
 *
 * No crea archivos ni comprueba su existencia en el almacenamiento.
 */
export function generarClavesFotografia(
  formatoOriginal: FormatoFotografiaOriginal,
): ClavesFotografia {
  // Comprobación defensiva: los tipos no validan valores en ejecución.
  if (
    !FORMATOS_FOTOGRAFIA_ORIGINAL.some(
      (permitido) => permitido === formatoOriginal,
    )
  ) {
    throw new Error(
      'No se pueden generar claves para un formato de fotografía no permitido.',
    );
  }

  const idOriginal = randomUUID();
  const idOptimizada = randomUUID();

  // Evita continuar si ambos identificadores coinciden inesperadamente.
  if (idOriginal === idOptimizada) {
    throw new Error(
      'No se pudieron generar identificadores distintos para las versiones.',
    );
  }

  return {
    original_s3_key: validarClaveAlmacenamiento(
      `fotografias/${idOriginal}.${formatoOriginal}`,
    ),
    s3_key: validarClaveAlmacenamiento(
      `fotografias/${idOptimizada}.${FORMATO_FOTOGRAFIA_OPTIMIZADA}`,
    ),
  };
}