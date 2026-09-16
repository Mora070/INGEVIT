import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import {
  ProyectoAccesoRepository,
} from '../../common/repositories/proyecto-acceso.repository';
import {
  ActividadesRepository,
} from '../actividades/actividades.repository';

import { PanoramicasRepository } from './panoramicas.repository';
import { mapearPanoramica } from './mappers/panoramica.mapper';
import type { PanoramicaResponse } from './types/panoramica.types';

/**
 * Guarda el título y su actividad en una misma transacción.
 * Permite la operación al propietario y a colaboradores con acceso.
 */
@Injectable()
export class PanoramicasEdicionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly acceso: ProyectoAccesoRepository,
    private readonly panoramicas: PanoramicasRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  async actualizarTitulo(
    idProyecto: string,
    idPanoramica: string,
    idUsuario: string,
    titulo: string,
  ): Promise<PanoramicaResponse> {
    return this.database.withTransaction(async (client) => {
      const disponible = await this.acceso.bloquearDisponible(
        client,
        idProyecto,
        idUsuario,
      );

      if (!disponible) {
        throw new NotFoundException('El proyecto no está disponible.');
      }

      const panoramica = await this.panoramicas.actualizarTitulo(
        client,
        idProyecto,
        idPanoramica,
        titulo,
      );

      if (panoramica === null) {
        throw new NotFoundException('La panorámica no está disponible.');
      }

      // Registra cada guardado correcto, incluso si el título no cambió.
      await this.actividades.crear(client, {
        idProyecto,
        idActor: idUsuario,
        tipoAccion: 'PANORAMICA_TITULO_GUARDADO',
        mensaje: `Título de la panorámica ${panoramica.id_panoramica} guardado.`,
      });

      return mapearPanoramica(panoramica);
    });
  }
}