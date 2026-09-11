import {
    BadRequestException,
    PayloadTooLargeException,
    UnsupportedMediaTypeException,
} from '@nestjs/common';

import sharp from 'sharp';
import type { Metadata } from 'sharp';

import {
    FORMATOS_FOTOGRAFIA_ORIGINAL,
    MAX_BYTES_FOTOGRAFIA_ORIGINAL,
} from '../config/procesamiento-fotografia.config';

import type {
    FormatoFotografiaOriginal,
} from '../config/procesamiento-fotografia.config';

/**
 * Información interna obtenida del contenido recibido.
 *
 * Las dimensiones corresponden a los metadatos de entrada,
 * sin aplicar todavía la orientación EXIF.
 */
export interface FotografiaInspeccionada {
    formato: FormatoFotografiaOriginal;
    bytes: number;
    ancho: number;
    alto: number;
    fotogramas: number;
}

/**
 * Inspecciona el contenido sin transformarlo ni almacenarlo.
 *
 * No confía en el nombre original ni en el MIME enviado por el cliente.
 * Leer metadatos no garantiza que todos los píxeles puedan decodificarse:
 * esa comprobación se completará durante el procesamiento.
 */
export async function inspeccionarFotografia(
    contenido: Buffer,
): Promise<FotografiaInspeccionada> {
    if (!Buffer.isBuffer(contenido) || contenido.length === 0) {
        throw new BadRequestException(
            'Debes proporcionar un archivo de fotografía no vacío.',
        );
    }

    if (contenido.length > MAX_BYTES_FOTOGRAFIA_ORIGINAL) {
        throw new PayloadTooLargeException(
            'La fotografía no puede superar 20 MiB.',
        );
    }

    let metadatos: Metadata;

    try {
        // Conservamos las protecciones predeterminadas de Sharp.
        metadatos = await sharp(contenido).metadata();
    } catch {
        throw new BadRequestException(
            'No se pudo interpretar la fotografía recibida.',
        );
    }

    const formato = FORMATOS_FOTOGRAFIA_ORIGINAL.find(
        (permitido) => permitido === metadatos.format,
    );

    if (!formato) {
        throw new UnsupportedMediaTypeException(
            'Solo se permiten fotografías JPG, JPEG, PNG y WebP.',
        );
    }

    const ancho = metadatos.width;
    const alto = metadatos.height;
    const fotogramas = metadatos.pages ?? 1;

    if (
        typeof ancho !== 'number'
        || typeof alto !== 'number'
        || !Number.isSafeInteger(ancho)
        || !Number.isSafeInteger(alto)
        || ancho <= 0
        || alto <= 0
        || !Number.isSafeInteger(fotogramas)
        || fotogramas <= 0
    ) {
        throw new BadRequestException(
            'La fotografía no contiene dimensiones válidas.',
        );
    }

    // Las fotografías animadas no forman parte de los formatos admitidos.
    if (fotogramas > 1) {
        throw new BadRequestException(
            'Solo se aceptan fotografías estáticas.',
        );
    }

    return {
        formato,
        bytes: contenido.length,
        ancho,
        alto,
        fotogramas,
    };
}