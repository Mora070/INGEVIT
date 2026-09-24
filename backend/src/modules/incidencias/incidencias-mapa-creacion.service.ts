import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import {
  ProyectoAccesoRepository,
} from '../../common/repositories/proyecto-acceso.repository';
import {
  ActividadesRepository,
} from '../actividades/actividades.repository';

import { IncidenciasRepository } from './incidencias.repository';
import {
  mapearIncidenciaMapa,
} from './mappers/incidencia-mapa.mapper';

import type {
  IncidenciaMapaResponse,
} from './mappers/incidencia-mapa.mapper';
import type {
  CrearIncidenciaMapaDto,
} from './dto/crear-incidencia-mapa.dto';

/**
 * Crea una incidencia directamente en el mapa.
 *
 * El controlador valida el DTO y obtiene el usuario de la sesión.
 * Este servicio comprueba el acceso al proyecto dentro de la transacción.
 *
 * Incidencia, notificaciones del trigger y actividad se confirman juntas.
 * No envía correos ni duplica las notificaciones generadas por PostgreSQL.
 */
@Injectable()
export class IncidenciasMapaCreacionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly acceso: ProyectoAccesoRepository,
    private readonly incidencias: IncidenciasRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  async crear(
    idProyecto: string,
    idUsuario: string,
    datos: CrearIncidenciaMapaDto,
  ): Promise<IncidenciaMapaResponse> {
    return this.database.withTransaction(async (client) => {
      const disponible = await this.acceso.bloquearDisponible(
        client,
        idProyecto,
        idUsuario,
      );

      if (!disponible) {
        throw new NotFoundException('El proyecto no está disponible.');
      }

      // Selección explícita: identidad y proyecto no proceden del DTO.
      const incidencia = await this.incidencias.crearEnMapa(client, {
        id_proyecto: idProyecto,
        id_creador: idUsuario,
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        prioridad: datos.prioridad,
        latitud: datos.latitud,
        longitud: datos.longitud,
      });

      await this.actividades.crear(client, {
        idProyecto,
        idActor: idUsuario,
        tipoAccion: 'INCIDENCIA_CREADA',
        mensaje:
          `Incidencia ${incidencia.id_incidencia} creada en el mapa.`,
      });

      // Un registro inválido impide confirmar la operación completa.
      return mapearIncidenciaMapa(incidencia);
    });
  }
}