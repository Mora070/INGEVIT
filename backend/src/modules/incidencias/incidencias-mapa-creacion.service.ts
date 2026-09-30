import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  DatabaseService,
} from '../../database/database.service';

import {
  ProyectoAccesoRepository,
} from '../../common/repositories/proyecto-acceso.repository';

import {
  ActividadesRepository,
} from '../actividades/actividades.repository';

import {
  IncidenciasRepository,
} from './incidencias.repository';

import {
  mapearIncidenciaMapa,
} from './mappers/incidencia-mapa.mapper';

import type {
  IncidenciaMapaResponse,
} from './mappers/incidencia-mapa.mapper';

import type {
  CrearIncidenciaMapaDto,
} from './dto/crear-incidencia-mapa.dto';

/**
 * Crea una incidencia directamente en el mapa.
 *
 * Todas las incidencias de mapa requieren:
 * - latitud
 * - longitud
 *
 * Opcionalmente pueden vincular:
 * - una fotografía
 * - una panorámica
 *
 * Nunca ambas al mismo tiempo.
 */
@Injectable()
export class IncidenciasMapaCreacionService {
  constructor(
    private readonly database:
      DatabaseService,

    private readonly acceso:
      ProyectoAccesoRepository,

    private readonly incidencias:
      IncidenciasRepository,

    private readonly actividades:
      ActividadesRepository,
  ) {}

  async crear(
    idProyecto: string,
    idUsuario: string,
    datos: CrearIncidenciaMapaDto,
  ): Promise<IncidenciaMapaResponse> {
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

        /*
         * Toda incidencia de mapa
         * necesita ubicación.
         */
        if (
          datos.latitud === undefined ||
          datos.longitud === undefined
        ) {
          throw new BadRequestException(
            'Debes seleccionar una ubicación en el mapa.',
          );
        }

        /*
         * Solo puede existir
         * un recurso multimedia asociado.
         */
        if (
          datos.id_fotografia &&
          datos.id_panoramica
        ) {
          throw new BadRequestException(
            'La incidencia puede vincular una fotografía o una panorámica, pero no ambas.',
          );
        }

        /*
         * Si se vincula una fotografía,
         * comprobamos que pertenezca
         * al proyecto.
         */
        if (
          datos.id_fotografia
        ) {
          const fotografia =
            await this.incidencias
              .obtenerFotografiaParaIncidencia(
                client,
                idProyecto,
                datos.id_fotografia,
              );

          if (
            !fotografia
          ) {
            throw new NotFoundException(
              'La fotografía no está disponible en este proyecto.',
            );
          }
        }

        /*
         * Si se vincula una panorámica,
         * comprobamos que pertenezca
         * al proyecto.
         */
        if (
          datos.id_panoramica
        ) {
          const panoramica =
            await this.incidencias
              .obtenerPanoramicaParaIncidencia(
                client,
                idProyecto,
                datos.id_panoramica,
              );

          if (
            !panoramica
          ) {
            throw new NotFoundException(
              'La panorámica no está disponible en este proyecto.',
            );
          }
        }

        /*
         * La ubicación siempre procede
         * del punto marcado por el usuario.
         */
        const incidencia =
          await this.incidencias.crearEnMapa(
            client,
            {
              id_proyecto:
                idProyecto,

              id_creador:
                idUsuario,

              titulo:
                datos.titulo,

              descripcion:
                datos.descripcion,

              prioridad:
                datos.prioridad,

              latitud:
                datos.latitud,

              longitud:
                datos.longitud,

              id_fotografia:
                datos.id_fotografia ??
                null,

              id_panoramica:
                datos.id_panoramica ??
                null,
            },
          );

        let detalleActividad =
          'de texto';

        if (
          incidencia.id_fotografia
        ) {
          detalleActividad =
            'vinculada a una fotografía';
        } else if (
          incidencia.id_panoramica
        ) {
          detalleActividad =
            'vinculada a una panorámica 360°';
        }

        await this.actividades.crear(
          client,
          {
            idProyecto,

            idActor:
              idUsuario,

            tipoAccion:
              'INCIDENCIA_CREADA',

            mensaje:
              `Incidencia ${incidencia.id_incidencia} creada en el mapa, ${detalleActividad}.`,
          },
        );

        return mapearIncidenciaMapa(
          incidencia,
        );
      },
    );
  }
}