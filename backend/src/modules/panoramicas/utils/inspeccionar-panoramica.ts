import {
    BadRequestException,
    PayloadTooLargeException,
    UnsupportedMediaTypeException,
} from '@nestjs/common';

import sharp from 'sharp';
import type { Metadata } from 'sharp';

import {
    leerFotogramasPng,
} from '../../../common/utils/leer-fotogramas-png';

import {
    MAX_BYTES_PANORAMICA,
} from '../config/subida-panoramica.config';

import type { MimePanoramica } from '../types/panoramica.types';

export interface PanoramicaInspeccionada {
    formato: 'jpeg' | 'png' | 'webp';
    mimeType: MimePanoramica;
    bytes: number;
    ancho: number;
    alto: number;
    proporcionDosAUno: boolean;
}

/**
 * Inspecciona una imagen estática sin modificar sus bytes.
 *
 * Las dimensiones devueltas consideran la orientación EXIF.
 * La proporción 2:1 es información geométrica, no prueba de una
 * captura esférica completa ni de una proyección equirectangular.
 */
export async function inspeccionarPanoramica(
    contenido: Buffer,
): Promise<PanoramicaInspeccionada> {
    if (!Buffer.isBuffer(contenido) || contenido.length === 0) {
        throw new BadRequestException(
            'Debes proporcionar una imagen panorámica no vacía.',
        );
    }

    if (contenido.length > MAX_BYTES_PANORAMICA) {
        throw new PayloadTooLargeException(
            'La panorámica no puede superar 50 MB.',
        );
    }

    let metadatos: Metadata;

    try {
        // Conserva el límite de píxeles predeterminado de Sharp.
        metadatos = await sharp(contenido, {
            failOn: 'warning',
        }).metadata();
    } catch {
        throw new BadRequestException(
            'No se pudo interpretar la imagen panorámica.',
        );
    }

    const formato = metadatos.format;

    if (
        formato !== 'jpeg' &&
        formato !== 'png' &&
        formato !== 'webp'
    ) {
        throw new UnsupportedMediaTypeException(
            'Solo se permiten panorámicas JPG, JPEG, PNG y WebP.',
        );
    }

    let fotogramas = metadatos.pages ?? 1;

    if (formato === 'png') {
        try {
            fotogramas = Math.max(fotogramas, leerFotogramasPng(contenido));
        } catch {
            throw new BadRequestException(
                'No se pudo interpretar la imagen panorámica.',
            );
        }
    }

    if (!Number.isSafeInteger(fotogramas) || fotogramas < 1) {
        throw new BadRequestException(
            'La imagen panorámica contiene metadatos inválidos.',
        );
    }

    if (fotogramas > 1) {
        throw new BadRequestException(
            'Solo se aceptan imágenes panorámicas estáticas.',
        );
    }

    const anchoOriginal = metadatos.width;
    const altoOriginal = metadatos.height;

    if (
        typeof anchoOriginal !== 'number' ||
        typeof altoOriginal !== 'number' ||
        !Number.isSafeInteger(anchoOriginal) ||
        !Number.isSafeInteger(altoOriginal) ||
        anchoOriginal < 1 ||
        altoOriginal < 1
    ) {
        throw new BadRequestException(
            'La imagen panorámica no contiene dimensiones válidas.',
        );
    }

    /*
     * Las orientaciones EXIF 5–8 intercambian los ejes.
     * Solo interpretamos las dimensiones; no rotamos el archivo.
     */
    const intercambiaEjes = [5, 6, 7, 8].includes(
        metadatos.orientation ?? 1,
    );

    const ancho = intercambiaEjes ? altoOriginal : anchoOriginal;
    const alto = intercambiaEjes ? anchoOriginal : altoOriginal;

    /*
     * metadata() solo lee encabezados.
     * stats() fuerza la decodificación para detectar errores del contenido,
     * sin generar otro archivo ni devolver un Buffer de píxeles.
     */
    const lector = sharp(contenido, { failOn: 'warning' });

    try {
        await lector.timeout({ seconds: 30 }).stats();
    } catch {
        throw new BadRequestException(
            'No se pudo decodificar la imagen panorámica dentro de los límites de procesamiento.',
        );
    } finally {
        lector.destroy();
    }

    const mimeType: MimePanoramica =
        formato === 'jpeg'
            ? 'image/jpeg'
            : formato === 'png'
                ? 'image/png'
                : 'image/webp';

    return {
        formato,
        mimeType,
        bytes: contenido.length,
        ancho,
        alto,
        proporcionDosAUno: ancho === alto * 2,
    };
}