import {
  ConflictException,
  Injectable,
  NotFoundException,
  //UnauthorizedException,
} from '@nestjs/common';

import {
  DatabaseService,
} from '../../database/database.service';

/*
import {
  ProyectosRepository,
} from '../proyectos/proyectos.repository';
*/

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
  CapasEliminacionRepository,
} from './capas-eliminacion.repository';

/**
 * Retira una capa y registra su limpieza en la misma transacción.
  * Permite la operación al propietario o a un colaborador
 * activo con acceso al proyecto.
 */
@Injectable()
export class CapasEliminacionService {
  constructor(
    private readonly database:
      DatabaseService,

    /*
        private readonly proyectos:
          ProyectosRepository,
    */

    private readonly acceso:
      ProyectoAccesoRepository,

    private readonly capas:
      CapasEliminacionRepository,

    private readonly actividades:
      ActividadesRepository,

    private readonly notificaciones:
      NotificacionesRepository,
  ) { }

  async eliminar(
    proyecto: string,
    capa: string,
    usuario: string,
  ): Promise<void> {
    await this.database.withTransaction(
      async (
        client,
      ) => {
        const disponible =
          await this.acceso.bloquearDisponible(
            client,
            proyecto,
            usuario,
          );

        if (
          !disponible
        ) {
          throw new NotFoundException(
            'El proyecto no está disponible para gestionar capas.',
          );
        }

        const fila =
          await this.capas.bloquear(
            client,
            proyecto,
            capa,
          );

        if (
          !fila
        ) {
          throw new NotFoundException(
            'La capa no está disponible.',
          );
        }

        if (
          fila.estado_procesamiento ===
          'PROCESANDO'
        ) {
          throw new ConflictException(
            'La capa está procesándose. Espera a que termine el intento.',
          );
        }

        if (
          fila.almacenamiento_proveedor !==
          'LOCAL' ||
          (
            fila.teselas_version !==
            null &&
            fila.teselas_proveedor !==
            'LOCAL'
          )
        ) {
          throw new ConflictException(
            'La eliminación de este proveedor todavía no está disponible.',
          );
        }

        await this.capas.registrar(
          client,
          fila,
        );

        await this.capas.eliminar(
          client,
          proyecto,
          capa,
        );

        await this.actividades.crear(
          client,
          {
            idProyecto:
              proyecto,

            idActor:
              usuario,

            tipoAccion:
              'CAPA_ELIMINADA',

            mensaje:
              `Se eliminó la capa ${capa}.`,
          },
        );

        await this.notificaciones.crearParaParticipantesProyecto(
          client,
          {
            id_actor:
              usuario,

            id_proyecto:
              proyecto,

            id_incidencia:
              null,

            tipo:
              'CAPA_ELIMINADA',

            titulo:
              'Capa eliminada',

            mensaje:
              'Se eliminó una capa del proyecto.',

            destino:
              'CAPAS',

            id_recurso:
              null,
          },
        );
      },
    );
  }
}