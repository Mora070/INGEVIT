import { Injectable, NotFoundException } from '@nestjs/common';
import type { Readable } from 'node:stream';

import {
  AlmacenamientoService,
} from '../almacenamiento/almacenamiento.service';

import {
  PlanosDescargaRepository,
} from './planos-descarga.repository';

/**
 * Abre el PDF únicamente después de comprobar el acceso.
 *
 * No recibe rutas locales ni acepta claves arbitrarias del cliente.
 */
@Injectable()
export class PlanosDescargaService {
  constructor(
    private readonly repositorio: PlanosDescargaRepository,
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  /**
   * nombreArchivo debe ser el último segmento de la URL: <uuid>.pdf.
   *
   * El consumidor debe consumir o destruir el flujo devuelto.
   * Los errores de almacenamiento se propagan: un fallo del disco
   * no se convierte automáticamente en un archivo inexistente.
   */
  async abrir(
    idProyecto: string,
    idUsuario: string,
    nombreArchivo: string,
  ): Promise<Readable> {
    const patron =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

    if (
      typeof nombreArchivo !== 'string' ||
      nombreArchivo.includes('\n') ||
      nombreArchivo.includes('\r') ||
      !patron.test(nombreArchivo)
    ) {
      throw new NotFoundException('El plano no está disponible.');
    }

    const plano = await this.repositorio.buscarDisponible(
      idProyecto,
      idUsuario,
      `planos/${nombreArchivo}`,
    );

    if (plano === null) {
      throw new NotFoundException('El plano no está disponible.');
    }

    return this.almacenamiento.abrirLectura(plano.s3_key);
  }
}