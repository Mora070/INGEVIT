import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import {
  ProyectoAccesoRepository,
} from '../../common/repositories/proyecto-acceso.repository';
import {
  ActividadesRepository,
} from '../actividades/actividades.repository';

import {
  PanoramicasPersistenciaService,
} from './panoramicas-persistencia.service';
import { PanoramicasRepository } from './panoramicas.repository';
import {
  inspeccionarPanoramica,
} from './utils/inspeccionar-panoramica';
import { mapearPanoramica } from './mappers/panoramica.mapper';

import type { SubirPanoramicaDto } from './dto/subir-panoramica.dto';
import type { PanoramicaResponse } from './types/panoramica.types';

/**
 * Coordina la recepción de una imagen panorámica.
 *
 * El usuario procede de la sesión autenticada.
 * La inspección comprueba el archivo, pero no certifica su contenido 360°.
 * Conserva los bytes originales, sin comprimir ni rotar.
 */
@Injectable()
export class PanoramicasSubidaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly acceso: ProyectoAccesoRepository,
    private readonly persistencia: PanoramicasPersistenciaService,
    private readonly panoramicas: PanoramicasRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  async subir(
    idProyecto: string,
    idUsuario: string,
    datos: SubirPanoramicaDto,
    contenido: Buffer,
  ): Promise<PanoramicaResponse> {
    const disponible = await this.database.withTransaction(
      (client) =>
        this.acceso.bloquearDisponible(client, idProyecto, idUsuario),
    );

    if (!disponible) {
      throw new NotFoundException('El proyecto no está disponible.');
    }

    const inspeccion = await inspeccionarPanoramica(contenido);

    return this.persistencia.guardarYRegistrar(
      contenido,
      inspeccion.formato,
      async (client, clave) => {
        /*
         * El acceso pudo cambiar durante la decodificación o escritura.
         * El bloqueo protege esta comprobación hasta confirmar.
         */
        const sigueDisponible = await this.acceso.bloquearDisponible(
          client,
          idProyecto,
          idUsuario,
        );

        if (!sigueDisponible) {
          throw new NotFoundException('El proyecto no está disponible.');
        }

        const nombreArchivo = clave.slice('panoramicas/'.length);

        const panoramica = await this.panoramicas.crear(client, {
          id_proyecto: idProyecto,
          id_usuario_subida: idUsuario,
          titulo: datos.titulo,
          url:
            `/api/proyectos/${idProyecto}/panoramicas/archivos/${nombreArchivo}`,
          s3_key: clave,
          mime_type: inspeccion.mimeType,
        });

        await this.actividades.crear(client, {
          idProyecto,
          idActor: idUsuario,
          tipoAccion: 'PANORAMICA_SUBIDA',
          mensaje: `Panorámica ${panoramica.id_panoramica} subida.`,
        });

        return mapearPanoramica(panoramica);
      },
    );
  }
}