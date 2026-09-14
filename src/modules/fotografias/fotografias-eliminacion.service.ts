import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

import {
  ActividadesRepository,
} from '../actividades/actividades.repository';

import {
  ArchivosPendientesRepository,
} from '../almacenamiento/archivos-pendientes.repository';

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
 *
 * No elimina archivos físicos. Ese trabajo se ejecutará
 * después de confirmar, mediante la cola persistente.
 */
@Injectable()
export class FotografiasEliminacionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly acceso: FotografiasAccesoRepository,
    private readonly fotografias: FotografiasRepository,
    private readonly pendientes: ArchivosPendientesRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  /**
   * Elimina una fotografía de un proyecto disponible.
   *
   * idUsuario debe proceder de la sesión autenticada.
   * El acceso permite al propietario y a sus colaboradores.
   *
   * Las claves pendientes proceden del registro eliminado,
   * nunca de datos enviados por el cliente.
   */
  async eliminar(
    idProyecto: string,
    idFotografia: string,
    idUsuario: string,
  ): Promise<void> {
    await this.database.withTransaction(async (client) => {
      const disponible = await this.acceso.bloquearDisponible(
        client,
        idProyecto,
        idUsuario,
      );

      if (!disponible) {
        throw new NotFoundException(
          'El proyecto no está disponible.',
        );
      }

      const fotografia = await this.fotografias.eliminar(
        client,
        idProyecto,
        idFotografia,
      );

      if (fotografia === null) {
        throw new NotFoundException(
          'La fotografía no está disponible.',
        );
      }

      /*
       * Las tareas solo serán visibles para otros procesos
       * después de confirmar esta transacción.
       *
       * Si este INSERT falla, también se revierte el DELETE.
       */
      await this.pendientes.registrar(client, [
        fotografia.original_s3_key,
        fotografia.s3_key,
      ]);

      await this.actividades.crear(client, {
        idProyecto,
        idActor: idUsuario,
        tipoAccion: 'FOTOGRAFIA_ELIMINADA',
        mensaje: `Fotografía ${fotografia.id_fotografia} eliminada.`,
      });
    });
  }
}