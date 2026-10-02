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
  FotografiasRepository,
} from './fotografias.repository';

import {
  mapearFotografia,
} from './mappers/fotografia.mapper';

import type {
  ActualizarTituloFotografiaDto,
} from './dto/actualizar-titulo-fotografia.dto';

import type {
  FotografiaResponse,
} from './types/fotografia.types';

@Injectable()
export class FotografiasEdicionService {
  constructor(
    private readonly database:
      DatabaseService,

    private readonly acceso:
      FotografiasAccesoRepository,

    private readonly fotografias:
      FotografiasRepository,

    private readonly actividades:
      ActividadesRepository,

    private readonly notificaciones:
      NotificacionesRepository,
  ) {}

  async actualizarTitulo(
    idProyecto: string,
    idFotografia: string,
    idUsuario: string,
    datos: ActualizarTituloFotografiaDto,
  ): Promise<FotografiaResponse> {
    return this.database.withTransaction(
      async (
        client,
      ) => {
        const disponible =
          await this.acceso.bloquearDisponible(
            client,
            idProyecto,
            idUsuario,
          );

        if (
          !disponible
        ) {
          throw new NotFoundException(
            'El proyecto no está disponible.',
          );
        }

        const fotografia =
          await this.fotografias.actualizarTitulo(
            client,
            idProyecto,
            idFotografia,
            datos.titulo,
          );

        if (
          fotografia ===
          null
        ) {
          throw new NotFoundException(
            'La fotografía no está disponible.',
          );
        }

        await this.actividades.crear(
          client,
          {
            idProyecto,
            idActor:
              idUsuario,

            tipoAccion:
              'FOTOGRAFIA_TITULO_GUARDADO',

            mensaje:
              `Título de la fotografía ${fotografia.id_fotografia} guardado.`,
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
              'FOTOGRAFIA_EDITADA',

            titulo:
              'Fotografía actualizada',

            mensaje:
              `Se actualizó la fotografía "${fotografia.titulo}".`,

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

  async establecerPortada(
    idProyecto: string,
    idFotografia: string,
    idUsuario: string,
  ): Promise<FotografiaResponse> {
    return this.database.withTransaction(
      async (
        client,
      ) => {
        const esPropietario =
          await this.acceso.bloquearPropietario(
            client,
            idProyecto,
            idUsuario,
          );

        if (
          !esPropietario
        ) {
          throw new NotFoundException(
            'El proyecto no está disponible.',
          );
        }

        const fotografia =
          await this.fotografias.establecerPortada(
            client,
            idProyecto,
            idFotografia,
          );

        if (
          fotografia ===
          null
        ) {
          throw new NotFoundException(
            'La fotografía no está disponible.',
          );
        }

        await this.actividades.crear(
          client,
          {
            idProyecto,
            idActor:
              idUsuario,

            tipoAccion:
              'FOTOGRAFIA_PORTADA_ESTABLECIDA',

            mensaje:
              `La fotografía ${fotografia.id_fotografia} fue establecida como portada del proyecto.`,
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
              'FOTOGRAFIA_PORTADA_ESTABLECIDA',

            titulo:
              'Portada del proyecto actualizada',

            mensaje:
              'Se cambió la fotografía de portada del proyecto.',

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