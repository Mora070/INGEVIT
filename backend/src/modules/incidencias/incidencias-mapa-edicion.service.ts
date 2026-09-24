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
  ActualizarIncidenciaDto,
} from './dto/actualizar-incidencia.dto';
import type {
  IncidenciaMapaResponse,
} from './mappers/incidencia-mapa.mapper';

/**
 * Guarda los datos descriptivos y su actividad en una transacción.
 *
 * Permite editar al propietario y a colaboradores activos con acceso.
 * El editor puede ser distinto del creador; la autoría se conserva.
 */
@Injectable()
export class IncidenciasMapaEdicionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly acceso: ProyectoAccesoRepository,
    private readonly incidencias: IncidenciasRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  async actualizarDatos(
    idProyecto: string,
    idIncidencia: string,
    idUsuario: string,
    datos: ActualizarIncidenciaDto,
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

      const incidencia = await this.incidencias.actualizarDatosEnMapa(
        client,
        idProyecto,
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

      await this.actividades.crear(client, {
        idProyecto,
        idActor: idUsuario,
        tipoAccion: 'INCIDENCIA_DATOS_GUARDADOS',
        mensaje:
          `Datos de la incidencia ${incidencia.id_incidencia} guardados.`,
      });

      // Un fallo del mapeo también impide confirmar los cambios.
      return mapearIncidenciaMapa(incidencia);
    });
  }
}