import {
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

/**
 * Elimina una incidencia propia y registra la actividad atómicamente.
 *
 * Ser propietario del proyecto o administrador no permite borrar
 * directamente incidencias creadas por otro usuario.
 */
@Injectable()
export class IncidenciasMapaEliminacionService {
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
  ) {}

  async eliminar(
    idProyecto: string,
    idIncidencia: string,
    idUsuario: string,
  ): Promise<void> {
    await this.database.withTransaction(
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

        const eliminada =
          await this.incidencias.eliminarPropiaEnMapa(
            client,
            idProyecto,
            idIncidencia,
            idUsuario,
          );

        if (
          !eliminada
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
              'INCIDENCIA_ELIMINADA',

            mensaje:
              `Incidencia ${idIncidencia} eliminada.`,
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
              'INCIDENCIA_ELIMINADA',

            titulo:
              'Incidencia eliminada',

            mensaje:
              'Se eliminó una incidencia del proyecto.',

            destino:
              'MAPA',

            id_recurso:
              null,
          },
        );
      },
    );
  }
}