import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { isAbsolute, posix } from 'node:path';
import type {} from 'multer';

import { GeoTiffInspectorService } from './geotiff-inspector.service';
import { CapasPersistenciaService } from './capas-persistencia.service';
import type { SubirCapaDto } from './dto/subir-capa.dto';
import type { CapaResponse } from './types/capa.types';

type ArchivoTemporalCapa = Pick<
  Express.Multer.File,
  'path' | 'size' | 'originalname'
>;

/**
 * Coordina la inspección y persistencia del original.
 *
 * Los guards comprueban sesión y propiedad antes de recibir el archivo.
 * El interceptor mantiene el temporal y lo limpia al finalizar.
 * La persistencia vuelve a comprobar permisos dentro de la transacción.
 */
@Injectable()
export class CapasSubidaService {
  constructor(
    private readonly inspector: GeoTiffInspectorService,
    private readonly persistencia: CapasPersistenciaService,
  ) {}

  async subir(
    idProyecto: string,
    idUsuario: string,
    datos: SubirCapaDto,
    archivo: ArchivoTemporalCapa | undefined,
  ): Promise<CapaResponse> {
    if (!archivo) {
      throw new BadRequestException(
        'El archivo GeoTIFF es obligatorio.',
      );
    }

    if (
      typeof archivo.path !== 'string'
      || !isAbsolute(archivo.path)
      || /[\u0000\r\n]/.test(archivo.path)
      || !Number.isSafeInteger(archivo.size)
      || archivo.size <= 0
    ) {
      throw new BadRequestException(
        'El archivo temporal de la capa no es válido.',
      );
    }

    if (
      typeof archivo.originalname !== 'string'
      || /[\u0000\r\n]/.test(archivo.originalname)
    ) {
      throw new BadRequestException(
        'El nombre del archivo no es válido.',
      );
    }

    /*
     * El nombre original es solo informativo.
     * Retiramos posibles componentes de ruta de Windows o Unix.
     * La persistencia generará una clave completamente independiente.
     */
    const nombreOriginal = posix.basename(
      archivo.originalname.replace(/\\/g, '/'),
    ).trim();

    if (
      nombreOriginal === ''
      || nombreOriginal === '.'
      || nombreOriginal === '..'
    ) {
      throw new BadRequestException(
        'El nombre del archivo es obligatorio.',
      );
    }

    // La inspección utiliza los bytes reales, no el MIME ni la extensión.
    const metadatos = await this.inspector.inspeccionar(archivo.path);

    return this.persistencia.guardarYRegistrar(
      idProyecto,
      idUsuario,
      {
        nombre: datos.nombre,
        descripcion: datos.descripcion,
      },
      {
        rutaTemporal: archivo.path,
        nombreOriginal,
        tamanoBytes: archivo.size,
        metadatos,
      },
    );
  }
}