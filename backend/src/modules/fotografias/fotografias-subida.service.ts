import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  DatabaseService,
} from '../../database/database.service';

import {
  ActividadesRepository,
} from '../actividades/actividades.repository';

import {
  NotificacionesRepository,
} from '../notificaciones/notificaciones.repository';

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

@Injectable()
export class FotografiasSubidaService {
  constructor(
    private readonly database:
      DatabaseService,

    private readonly acceso:
      FotografiasAccesoRepository,

    private readonly persistencia:
      FotografiasPersistenciaService,

    private readonly fotografias:
      FotografiasRepository,

    private readonly actividades:
      ActividadesRepository,

    private readonly notificaciones:
      NotificacionesRepository,
  ) {}

  async subir(
    idProyecto: string,
    idUsuario: string,
    datos: SubirFotografiaDto,
    contenido: Buffer,
  ): Promise<FotografiaResponse> {
    const disponible =
      await this.database.withTransaction(
        async (
          client,
        ) =>
          this.acceso.bloquearDisponible(
            client,
            idProyecto,
            idUsuario,
          ),
      );

    if (
      !disponible
    ) {
      throw new NotFoundException(
        'El proyecto no está disponible.',
      );
    }

    const procesada =
      await procesarFotografia(
        contenido,
      );

    return this.persistencia.guardarYRegistrar(
      procesada,
      async (
        client,
        claves,
      ) => {
        const sigueDisponible =
          await this.acceso.bloquearDisponible(
            client,
            idProyecto,
            idUsuario,
          );

        if (
          !sigueDisponible
        ) {
          throw new NotFoundException(
            'El proyecto no está disponible.',
          );
        }

        const fotografia =
          await this.fotografias.crear(
            client,
            {
              idProyecto,

              idUsuarioSubida:
                idUsuario,

              titulo:
                datos.titulo,

              url:
                generarUrlFotografia(
                  idProyecto,
                  claves.s3_key,
                ),

              s3Key:
                claves.s3_key,

              originalS3Key:
                claves.original_s3_key,
            },
          );

        await this.actividades.crear(
          client,
          {
            idProyecto,

            idActor:
              idUsuario,

            tipoAccion:
              'FOTOGRAFIA_SUBIDA',

            mensaje:
              `Fotografía ${fotografia.id_fotografia} subida.`,
          },
        );

        await this.notificaciones.crearParaParticipantesProyecto(
          client,
          {
            id_actor:
              idUsuario,

            id_proyecto:
              idProyecto,

            id_incidencia:
              null,

            tipo:
              'FOTOGRAFIA_CREADA',

            titulo:
              'Nueva fotografía',

            mensaje:
              `Se agregó la fotografía "${fotografia.titulo}".`,

            destino:
              'FOTOGRAFIAS',

            id_recurso:
              fotografia.id_fotografia,
          },
        );

        return mapearFotografia(
          fotografia,
        );
      },
    );
  }
}