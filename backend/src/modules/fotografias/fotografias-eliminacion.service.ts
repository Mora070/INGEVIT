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
  ArchivosPendientesRepository,
} from '../almacenamiento/archivos-pendientes.repository';

import {
  NotificacionesRepository,
} from '../notificaciones/notificaciones.repository';

import {
  FotografiasAccesoRepository,
} from './fotografias-acceso.repository';

import {
  FotografiasRepository,
} from './fotografias.repository';

/**
 * Coordina la eliminación de fotografías.
 *
 * En una misma transacción:
 * - Comprueba la autorización.
 * - Elimina el registro de la fotografía.
 * - Registra el borrado pendiente de ambas versiones.
 * - Registra la actividad del solicitante.
 * - Notifica a los demás participantes del proyecto.
 *
 * No elimina archivos físicos. Ese trabajo se ejecutará
 * después de confirmar, mediante la cola persistente.
 */
@Injectable()
export class FotografiasEliminacionService {
  constructor(
    private readonly database:
      DatabaseService,

    private readonly acceso:
      FotografiasAccesoRepository,

    private readonly fotografias:
      FotografiasRepository,

    private readonly pendientes:
      ArchivosPendientesRepository,

    private readonly actividades:
      ActividadesRepository,

    private readonly notificaciones:
      NotificacionesRepository,
  ) {}

  async eliminar(
    idProyecto: string,
    idFotografia: string,
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

        const fotografia =
          await this.fotografias.eliminar(
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

        await this.pendientes.registrar(
          client,
          [
            fotografia.original_s3_key,
            fotografia.s3_key,
          ],
        );

        await this.actividades.crear(
          client,
          {
            idProyecto,

            idActor:
              idUsuario,

            tipoAccion:
              'FOTOGRAFIA_ELIMINADA',

            mensaje:
              `Fotografía ${fotografia.id_fotografia} eliminada.`,
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
              'FOTOGRAFIA_ELIMINADA',

            titulo:
              'Fotografía eliminada',

            mensaje:
              'Se eliminó una fotografía del proyecto.',

            destino:
              'FOTOGRAFIAS',

            id_recurso:
              null,
          },
        );
      },
    );
  }
}