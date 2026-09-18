import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import {
  ProyectoAccesoRepository,
} from '../../common/repositories/proyecto-acceso.repository';
import {
  ActividadesRepository,
} from '../actividades/actividades.repository';

import { IncidenciasPlanoRepository } from './incidencias-plano.repository';
import { IncidenciasRepository } from './incidencias.repository';

/**
 * Elimina una incidencia propia y registra la actividad.
 *
 * Ser propietario del proyecto o administrador global no permite
 * eliminar directamente una incidencia creada por otro usuario.
 */
@Injectable()
export class IncidenciasEliminacionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly acceso: ProyectoAccesoRepository,
    private readonly planos: IncidenciasPlanoRepository,
    private readonly incidencias: IncidenciasRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  async eliminar(
    idProyecto: string,
    idPlano: string,
    idIncidencia: string,
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

      const paginas = await this.planos.bloquearDisponible(
        client,
        idProyecto,
        idPlano,
      );

      if (paginas === null) {
        throw new NotFoundException('El plano no está disponible.');
      }

      const eliminada = await this.incidencias.eliminarPropia(
        client,
        idProyecto,
        idPlano,
        idIncidencia,
        idUsuario,
      );

      if (!eliminada) {
        // La misma respuesta cubre inexistencia y autoría ajena.
        throw new NotFoundException('La incidencia no está disponible.');
      }

      await this.actividades.crear(client, {
        idProyecto,
        idActor: idUsuario,
        tipoAccion: 'INCIDENCIA_ELIMINADA',
        mensaje: `Incidencia ${idIncidencia} eliminada.`,
      });
    });
  }
}