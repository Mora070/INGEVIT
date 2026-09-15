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

import { PlanosRepository } from './planos.repository';

/**
 * Elimina un plano disponible para el propietario o colaborador.
 *
 * En una misma transacción:
 * - Comprueba y mantiene el acceso.
 * - Elimina el plano y sus incidencias por cascada.
 * - Programa la eliminación del PDF.
 * - Registra la actividad.
 *
 * No accede al almacenamiento físico. Si falla alguna escritura,
 * PostgreSQL revierte todos los cambios de esta operación.
 */
@Injectable()
export class PlanosEliminacionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly acceso: ProyectoAccesoRepository,
    private readonly planos: PlanosRepository,
    private readonly pendientes: ArchivosPendientesRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  async eliminar(
    idProyecto: string,
    idPlano: string,
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

      const plano = await this.planos.eliminar(
        client,
        idProyecto,
        idPlano,
      );

      if (plano === null) {
        throw new NotFoundException('El plano no está disponible.');
      }

      // La clave procede del registro eliminado, nunca del cliente.
      await this.pendientes.registrar(client, [plano.s3_key]);

      await this.actividades.crear(client, {
        idProyecto,
        idActor: idUsuario,
        tipoAccion: 'PLANO_ELIMINADO',
        mensaje: `Plano ${plano.id_plano} eliminado.`,
      });
    });
  }
}