import { Injectable } from '@nestjs/common';

import {
  inspeccionarGeoTiff,
} from './utils/inspeccionar-geotiff';

/**
 * Encapsula la inspección real para poder sustituirla en pruebas
 * del coordinador sin ejecutar procesos externos.
 */
@Injectable()
export class GeoTiffInspectorService {
  async inspeccionar(rutaTemporal: string) {
    return inspeccionarGeoTiff(rutaTemporal);
  }
}