import { Injectable, NotFoundException } from '@nestjs/common';
import type { Readable } from 'node:stream';

import {
  AlmacenamientoService,
} from '../almacenamiento/almacenamiento.service';

import {
  PanoramicasDescargaRepository,
} from './panoramicas-descarga.repository';
import type { MimePanoramica } from './types/panoramica.types';

export interface DescargaPanoramica {
  flujo: Readable;
  mimeType: MimePanoramica;
}

@Injectable()
export class PanoramicasDescargaService {
  constructor(
    private readonly repositorio: PanoramicasDescargaRepository,
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  /**
   * Abre únicamente la clave autorizada por PostgreSQL.
   * El consumidor debe consumir o destruir el flujo.
   */
  async abrir(
    idProyecto: string,
    idUsuario: string,
    nombreArchivo: string,
  ): Promise<DescargaPanoramica> {
    const patron =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/;

    if (
      typeof nombreArchivo !== 'string' ||
      nombreArchivo.includes('\n') ||
      nombreArchivo.includes('\r') ||
      !patron.test(nombreArchivo)
    ) {
      throw new NotFoundException('La panorámica no está disponible.');
    }

    const panoramica = await this.repositorio.buscarDisponible(
      idProyecto,
      idUsuario,
      `panoramicas/${nombreArchivo}`,
    );

    if (panoramica === null) {
      throw new NotFoundException('La panorámica no está disponible.');
    }

    const mime = panoramica.mime_type;

    // Comprobación defensiva antes de utilizar el valor como cabecera HTTP.
    if (
      mime !== 'image/jpeg' &&
      mime !== 'image/png' &&
      mime !== 'image/webp'
    ) {
      throw new Error('La panorámica tiene un tipo MIME inesperado.');
    }

    const flujo = await this.almacenamiento.abrirLectura(
      panoramica.s3_key,
    );

    return { flujo, mimeType: mime };
  }
}