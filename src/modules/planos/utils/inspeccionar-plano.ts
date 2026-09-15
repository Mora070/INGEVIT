import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';

import {
  EncryptedPDFError,
  PDFDocument,
} from 'pdf-lib';

import { MAX_BYTES_PLANO } from '../config/subida-plano.config';

export interface PlanoInspeccionado {
  bytes: number;
  numeroPaginas: number;
  mimeType: 'application/pdf';
}

/**
 * Comprueba que el archivo pueda interpretarse como PDF
 * y que contenga al menos una página.
 *
 * No utiliza el nombre ni el MIME declarado por el cliente.
 * No modifica, comprime ni vuelve a guardar el documento.
 *
 * La lectura estructural no garantiza que todos los elementos
 * puedan renderizarse en cualquier visor.
 */
export async function inspeccionarPlano(
  contenido: Buffer,
): Promise<PlanoInspeccionado> {
  if (!Buffer.isBuffer(contenido) || contenido.length === 0) {
    throw new BadRequestException(
      'Debes proporcionar un archivo de plano no vacío.',
    );
  }

  if (contenido.length > MAX_BYTES_PLANO) {
    throw new PayloadTooLargeException(
      'El plano no puede superar 35 MiB.',
    );
  }

  let numeroPaginas: number;

  try {
    const documento = await PDFDocument.load(contenido, {
      ignoreEncryption: false,
      throwOnInvalidObject: true,
      updateMetadata: false,
    });

    numeroPaginas = documento.getPageCount();
  } catch (error: unknown) {
    /*
     * La distribución de pdf-lib instalada no conserva el prototipo
     * de EncryptedPDFError. Por eso instanceof puede devolver false.
     *
     * Como alternativa, comparamos el mensaje completo generado por
     * la propia biblioteca, sin depender de una coincidencia parcial.
     */
    const esErrorDeCifrado =
      error instanceof EncryptedPDFError ||
      (
        error instanceof Error &&
        error.message === new EncryptedPDFError().message
      );

    if (esErrorDeCifrado) {
      throw new BadRequestException(
        'No se admiten planos PDF cifrados en esta implementación.',
      );
    }

    throw new BadRequestException(
      'No se pudo interpretar el archivo como un PDF válido.',
    );
  }

  if (
    !Number.isSafeInteger(numeroPaginas) ||
    numeroPaginas < 1
  ) {
    throw new BadRequestException(
      'El plano PDF debe contener al menos una página.',
    );
  }

  return {
    bytes: contenido.length,
    numeroPaginas,
    mimeType: 'application/pdf',
  };
}