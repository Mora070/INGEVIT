import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import {
  ProyectoAccesoRepository,
} from '../../common/repositories/proyecto-acceso.repository';
import {
  ActividadesRepository,
} from '../actividades/actividades.repository';
import {
  ArchivosPendientesRepository,
} from '../almacenamiento/archivos-pendientes.repository';

import { PanoramicasRepository } from './panoramicas.repository';

/**
 * Permite eliminar al propietario o a un colaborador con acceso.
 *
 * Registro, tarea pendiente y actividad participan en una transacción.
 * No elimina archivos físicos durante esta operación.
 */
@Injectable()
export class PanoramicasEliminacionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly acceso: ProyectoAccesoRepository,
    private readonly panoramicas: PanoramicasRepository,
    private readonly pendientes: ArchivosPendientesRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  async eliminar(
    idProyecto: string,
    idPanoramica: string,
    idUsuario: string,
  ): Promise<void> {
    await this.database.withTransaction(async (client) => {
      const disponible = await this.acceso.bloquearDisponible(
        client,
        idProyecto,
        idUsuario,
      );

      if (!disponible) {
        throw new NotFoundException('El proyecto no está disponible.');
      }

      const panoramica = await this.panoramicas.eliminar(
        client,
        idProyecto,
        idPanoramica,
      );

      if (panoramica === null) {
        throw new NotFoundException('La panorámica no está disponible.');
      }

      // La clave procede del registro eliminado, no del cliente HTTP.
      await this.pendientes.registrar(client, [panoramica.s3_key]);

      await this.actividades.crear(client, {
        idProyecto,
        idActor: idUsuario,
        tipoAccion: 'PANORAMICA_ELIMINADA',
        mensaje: `Panorámica ${panoramica.id_panoramica} eliminada.`,
      });
    });
  }
}