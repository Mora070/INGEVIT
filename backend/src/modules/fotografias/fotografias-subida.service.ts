import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

import {
  ActividadesRepository,
} from '../actividades/actividades.repository';

import {
  FotografiasAccesoRepository,
} from './fotografias-acceso.repository';

import {
  FotografiasPersistenciaService,
} from './fotografias-persistencia.service';

import {
  FotografiasRepository,
} from './fotografias.repository';

import {
  procesarFotografia,
} from './utils/optimizar-fotografia';

import {
  generarUrlFotografia,
} from './utils/generar-url-fotografia';

import {
  mapearFotografia,
} from './mappers/fotografia.mapper';

import type {
  SubirFotografiaDto,
} from './dto/subir-fotografia.dto';

import type {
  FotografiaResponse,
} from './types/fotografia.types';

/**
 * Coordina la subida de una fotografía y sus dos versiones.
 *
 * La identidad del solicitante debe proceder de la sesión autenticada.
 * El título debe haber sido validado por el DTO.
 *
 * La recepción HTTP debe limitar el archivo antes de acumularlo
 * completamente en memoria.
 */
@Injectable()
export class FotografiasSubidaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly acceso: FotografiasAccesoRepository,
    private readonly persistencia: FotografiasPersistenciaService,
    private readonly fotografias: FotografiasRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  /**
   * Permite subir fotografías al propietario y a los colaboradores
   * activos de un proyecto disponible.
   *
   * Devuelve la representación pública después de confirmar el registro.
   * La URL corresponde exclusivamente a la versión optimizada.
   */
  async subir(
    idProyecto: string,
    idUsuario: string,
    datos: SubirFotografiaDto,
    contenido: Buffer,
  ): Promise<FotografiaResponse> {
    /*
     * Primera comprobación: rechaza accesos no autorizados antes
     * de invertir recursos en procesamiento y almacenamiento.
     *
     * Esta transacción termina antes de procesar la imagen.
     */
    const disponible = await this.database.withTransaction(
      async (client) =>
        this.acceso.bloquearDisponible(
          client,
          idProyecto,
          idUsuario,
        ),
    );

    if (!disponible) {
      throw new NotFoundException(
        'El proyecto no está disponible.',
      );
    }

    const procesada = await procesarFotografia(contenido);

    return this.persistencia.guardarYRegistrar(
      procesada,
      async (client, claves) => {
        /*
         * El acceso pudo cambiar durante el procesamiento o la escritura.
         * Lo comprobamos nuevamente dentro de la transacción de registro.
         */
        const sigueDisponible = await this.acceso.bloquearDisponible(
          client,
          idProyecto,
          idUsuario,
        );

        if (!sigueDisponible) {
          throw new NotFoundException(
            'El proyecto no está disponible.',
          );
        }

        const fotografia = await this.fotografias.crear(
          client,
          {
            idProyecto,
            idUsuarioSubida: idUsuario,
            titulo: datos.titulo,
            url: generarUrlFotografia(
              idProyecto,
              claves.s3_key,
            ),
            s3Key: claves.s3_key,
            originalS3Key: claves.original_s3_key,
          },
        );

        await this.actividades.crear(client, {
          idProyecto,
          idActor: idUsuario,
          tipoAccion: 'FOTOGRAFIA_SUBIDA',
          mensaje: `Fotografía ${fotografia.id_fotografia} subida.`,
        });

        // El mapeo forma parte de la operación antes de confirmar.
        return mapearFotografia(fotografia);
      },
    );
  }
}