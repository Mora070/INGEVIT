import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import {
  ProyectoAccesoRepository,
} from '../../common/repositories/proyecto-acceso.repository';
import {
  ActividadesRepository,
} from '../actividades/actividades.repository';

import { IncidenciasPlanoRepository } from './incidencias-plano.repository';
import { IncidenciasRepository } from './incidencias.repository';
import { mapearIncidencia } from '././mappers/incidencia.mapper';

import type { IncidenciaResponse } from '././mappers/incidencia.mapper';
import type { CrearIncidenciaDto } from './dto/crear-incidencia.dto';

/**
 * Crea una incidencia y su actividad de forma atómica.
 *
 * El DTO valida los datos de entrada; este servicio comprueba
 * las reglas que dependen del estado actual de PostgreSQL.
 */
@Injectable()
export class IncidenciasCreacionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly acceso: ProyectoAccesoRepository,
    private readonly planos: IncidenciasPlanoRepository,
    private readonly incidencias: IncidenciasRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  async crear(
    idProyecto: string,
    idPlano: string,
    idUsuario: string,
    datos: CrearIncidenciaDto,
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

      const numeroPaginas = await this.planos.bloquearDisponible(
        client,
        idProyecto,
        idPlano,
      );

      if (numeroPaginas === null) {
        throw new NotFoundException('El plano no está disponible.');
      }

      // También protege llamadas internas que no pasen por el DTO.
      if (
        !Number.isInteger(datos.numero_pagina) ||
        datos.numero_pagina < 1 ||
        datos.numero_pagina > numeroPaginas
      ) {
        throw new BadRequestException(
          'La página indicada no existe en el plano.',
        );
      }

      const incidencia = await this.incidencias.crear(client, {
        id_proyecto: idProyecto,
        id_plano: idPlano,
        id_creador: idUsuario,
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        prioridad: datos.prioridad,
        numero_pagina: datos.numero_pagina,
        coordenada_x: datos.coordenada_x,
        coordenada_y: datos.coordenada_y,
      });

      await this.actividades.crear(client, {
        idProyecto,
        idActor: idUsuario,
        tipoAccion: 'INCIDENCIA_CREADA',
        mensaje:
          `Incidencia ${incidencia.id_incidencia} creada en el plano ${idPlano}.`,
      });

      // Un fallo de conversión también impide confirmar la transacción.
      return mapearIncidencia(incidencia);
    });
  }
}