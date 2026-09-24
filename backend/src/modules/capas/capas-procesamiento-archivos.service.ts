import { Injectable } from '@nestjs/common';

import {
  AlmacenamientoService,
} from '../almacenamiento/almacenamiento.service';
import { GeoTiffInspectorService } from './geotiff-inspector.service';
import type { CapaRow } from './types/capa.types';
import { recibirTemporalCapa } from './utils/recibir-temporal-capa';
import { conTeselasGeneradas } from './utils/generar-teselas';
import {
  publicarTeselasLocales,
} from './utils/publicar-teselas-locales';
import type {
  PublicacionTeselas,
} from './utils/publicar-teselas-locales';

/**
 * Lee el original, genera las teselas y publica una versión.
 *
 * Los temporales permanecen disponibles hasta terminar el registro.
 * El original se lee mediante el almacenamiento y nunca se modifica.
 */
@Injectable()
export class CapasProcesamientoArchivosService {
  constructor(
    private readonly almacenamiento: AlmacenamientoService,
    private readonly inspector: GeoTiffInspectorService,
  ) {}

  async procesar<T>(
    capa: CapaRow,
    registrar: (publicacion: PublicacionTeselas) => Promise<T>,
  ): Promise<T> {
    if (capa.almacenamiento_proveedor !== 'LOCAL') {
      throw new Error(
        'El procesamiento de originales de este proveedor aún no está implementado.',
      );
    }

    const tamano = Number(capa.tamano_original_bytes);

    if (
      !Number.isSafeInteger(tamano)
      || tamano <= 0
      || tamano >= Number.MAX_SAFE_INTEGER
    ) {
      throw new Error('El tamaño registrado del original no es válido.');
    }

    const entrada = await this.almacenamiento.abrirLectura(
      capa.original_key,
    );

    try {
      return await recibirTemporalCapa(
        entrada,
        tamano,
        async (temporal) => {
          if (temporal.tamanoBytes !== tamano) {
            throw new Error(
              'El tamaño del original no coincide con el registrado.',
            );
          }

          const metadatos = await this.inspector.inspeccionar(
            temporal.ruta,
          );

          return conTeselasGeneradas(
            temporal.ruta,
            metadatos.bbox,
            async (generacion) => publicarTeselasLocales(
              capa.id_capa,
              generacion,
              registrar,
            ),
          );
        },
      );
    } finally {
      entrada.destroy();
    }
  }
}