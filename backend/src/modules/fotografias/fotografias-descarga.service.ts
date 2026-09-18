import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Readable } from 'node:stream';

import {
  AlmacenamientoService,
} from '../almacenamiento/almacenamiento.service';

import {
  FotografiasDescargaRepository,
} from './fotografias-descarga.repository';

/**
 * Coordina la descarga de fotografías optimizadas.
 *
 * Primero comprueba el acceso en PostgreSQL.
 * Solo después solicita la lectura del archivo.
 *
 * No permite descargar el original de respaldo.
 */
@Injectable()
export class FotografiasDescargaService {
  constructor(
    private readonly repositorio: FotografiasDescargaRepository,
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  /**
   * Abre la versión optimizada disponible para el solicitante.
   *
   * nombreArchivo es únicamente el último segmento de la URL:
   * "<uuid>.webp". Nunca se recibe una ruta local del cliente.
   *
   * Quien recibe el Readable debe consumirlo o destruirlo
   * para liberar el recurso de almacenamiento.
   */
  async abrirOptimizada(
    idProyecto: string,
    idUsuario: string,
    nombreArchivo: string,
  ): Promise<Readable> {
    /*
     * Las claves generadas por la aplicación utilizan UUID en
     * minúsculas. La coincidencia completa también rechaza
     * separadores de ruta, espacios y saltos de línea.
     */
    const patron =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

    if (
      typeof nombreArchivo !== 'string' ||
      nombreArchivo.includes('\n') ||
      nombreArchivo.includes('\r') ||
      !patron.test(nombreArchivo)
    ) {
      throw new NotFoundException(
        'La fotografía no está disponible.',
      );
    }

    const clave = `fotografias/${nombreArchivo}`;

    const fotografia =
      await this.repositorio.buscarOptimizadaDisponible(
        idProyecto,
        idUsuario,
        clave,
      );

    if (fotografia === null) {
      throw new NotFoundException(
        'La fotografía no está disponible.',
      );
    }

    /*
     * Abrimos la clave obtenida del repositorio autorizado,
     * no una ruta proporcionada directamente por el cliente.
     *
     * Los errores del almacenamiento se propagan. No convertimos
     * indiscriminadamente fallos de disco o permisos en HTTP 404.
     */
    return this.almacenamiento.abrirLectura(
      fotografia.s3_key,
    );
  }
}