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
import { mapearIncidencia } from './mappers/incidencia.mapper';

import type { ActualizarIncidenciaDto } from './dto/actualizar-incidencia.dto';
import type { IncidenciaResponse } from './mappers/incidencia.mapper';

/**
 * Guarda los datos editables y su actividad en una sola transacción.
 *
 * Mantiene el orden de bloqueos utilizado en la creación:
 * usuarios/proyecto -> plano -> incidencia.
 */
@Injectable()
export class IncidenciasEdicionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly acceso: ProyectoAccesoRepository,
    private readonly planos: IncidenciasPlanoRepository,
    private readonly incidencias: IncidenciasRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  async actualizarDatos(
    idProyecto: string,
    idPlano: string,
    idIncidencia: string,
    idUsuario: string,
    datos: ActualizarIncidenciaDto,
  ): Promise<IncidenciaResponse> {
    return this.database.withTransaction(async (client) => {
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

      const incidencia = await this.incidencias.actualizarDatos(
        client,
        idProyecto,
        idPlano,
        idIncidencia,
        {
          titulo: datos.titulo,
          descripcion: datos.descripcion,
          prioridad: datos.prioridad,
          estado: datos.estado,
        },
      );

      if (incidencia === null) {
        throw new NotFoundException('La incidencia no está disponible.');
      }

      /*
       * Registra un guardado correcto, aunque los valores coincidan
       * con los anteriores. El actor puede ser distinto del creador.
       */
      await this.actividades.crear(client, {
        idProyecto,
        idActor: idUsuario,
        tipoAccion: 'INCIDENCIA_DATOS_GUARDADOS',
        mensaje: `Datos de la incidencia ${incidencia.id_incidencia} guardados.`,
      });

      return mapearIncidencia(incidencia);
    });
  }
}