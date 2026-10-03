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
  NotificacionesRepository,
} from '../notificaciones/notificaciones.repository';

import {
  IncidenciasRepository,
} from './incidencias.repository';

import {
  mapearIncidenciaMapa,
} from './mappers/incidencia-mapa.mapper';

import type {
  ActualizarIncidenciaMapaDto,
} from './dto/actualizar-incidencia-mapa.dto';

import type {
  IncidenciaMapaResponse,
} from './mappers/incidencia-mapa.mapper';

/**
 * Actualiza una incidencia ubicada
 * directamente sobre el mapa.
 *
 * Permite modificar:
 * - título;
 * - descripción;
 * - prioridad;
 * - estado;
 * - ubicación;
 * - fotografía asociada;
 * - panorámica asociada.
 *
 * Nunca permite asociar fotografía
 * y panorámica al mismo tiempo.
 *
 * Conserva:
 * - creador;
 * - fecha de creación.
 */
@Injectable()
export class IncidenciasMapaEdicionService {
  constructor(
    private readonly database:
      DatabaseService,

    private readonly acceso:
      ProyectoAccesoRepository,

    private readonly incidencias:
      IncidenciasRepository,

    private readonly actividades:
      ActividadesRepository,

    private readonly notificaciones:
      NotificacionesRepository,
  ) { }

  async actualizarDatos(
    idProyecto: string,
    idIncidencia: string,
    idUsuario: string,
    datos: ActualizarIncidenciaMapaDto,
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
         * Obtenemos y bloqueamos la incidencia
         * antes de modificarla.
         *
         * Esto permite conservar la asociación
         * multimedia actual cuando el cliente
         * todavía no envía esos campos.
         */
        const incidenciaActual =
          await this.incidencias.obtenerEnMapa(
            client,
            idProyecto,
            idIncidencia,
          );

        if (
          !incidenciaActual
        ) {
          throw new NotFoundException(
            'La incidencia no está disponible.',
          );
        }

        /*
         * Si el campo no fue enviado,
         * conservamos el recurso actualmente
         * relacionado con la incidencia.
         *
         * Si fue enviado como null,
         * eliminamos esa relación.
         */
        const idFotografia =
          datos.id_fotografia === undefined
            ? incidenciaActual.id_fotografia
            : datos.id_fotografia;

        const idPanoramica =
          datos.id_panoramica === undefined
            ? incidenciaActual.id_panoramica
            : datos.id_panoramica;

        /*
         * Una incidencia nunca puede estar
         * vinculada simultáneamente con una
         * fotografía y una panorámica.
         */
        if (
          idFotografia &&
          idPanoramica
        ) {
          throw new BadRequestException(
            'La incidencia puede vincular una fotografía o una panorámica, pero no ambas.',
          );
        }

        /*
         * Si existe una fotografía asociada,
         * comprobamos que realmente pertenezca
         * al proyecto.
         */
        if (
          idFotografia
        ) {
          const fotografia =
            await this.incidencias
              .obtenerFotografiaParaIncidencia(
                client,
                idProyecto,
                idFotografia,
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
         * Si existe una panorámica asociada,
         * comprobamos que realmente pertenezca
         * al proyecto.
         */
        if (
          idPanoramica
        ) {
          const panoramica =
            await this.incidencias
              .obtenerPanoramicaParaIncidencia(
                client,
                idProyecto,
                idPanoramica,
              );

          if (
            !panoramica
          ) {
            throw new NotFoundException(
              'La panorámica no está disponible en este proyecto.',
            );
          }
        }

        const incidencia =
          await this.incidencias.actualizarDatosEnMapa(
            client,
            idProyecto,
            idIncidencia,
            {
              titulo:
                datos.titulo,

              descripcion:
                datos.descripcion,

              prioridad:
                datos.prioridad,

              estado:
                datos.estado,

              latitud:
                datos.latitud,

              longitud:
                datos.longitud,

              id_fotografia:
                idFotografia,

              id_panoramica:
                idPanoramica,
            },
          );

        if (
          incidencia === null
        ) {
          throw new NotFoundException(
            'La incidencia no está disponible.',
          );
        }

        await this.actividades.crear(
          client,
          {
            idProyecto,

            idActor:
              idUsuario,

            tipoAccion:
              'INCIDENCIA_DATOS_GUARDADOS',

            mensaje:
              `Datos de la incidencia ${incidencia.id_incidencia} guardados.`,
          },
        );

        await this.notificaciones
          .crearParaParticipantesProyecto(
            client,
            {
              id_actor:
                idUsuario,

              id_proyecto:
                idProyecto,

              id_incidencia:
                incidencia.id_incidencia,

              tipo:
                'INCIDENCIA_EDITADA',

              titulo:
                'Incidencia actualizada',

              mensaje:
                `Se actualizó la incidencia "${incidencia.titulo}".`,

              destino:
                'MAPA',

              id_recurso:
                incidencia.id_incidencia,
            },
          );

        return mapearIncidenciaMapa(
          incidencia,
        );
      },
    );
  }
}