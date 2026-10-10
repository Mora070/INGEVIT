import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
/*
import { ProyectosRepository } from '../proyectos/proyectos.repository';
*/

import {
  ProyectoAccesoRepository,
} from '../../common/repositories/proyecto-acceso.repository';
import { ActividadesRepository } from '../actividades/actividades.repository';

import { CapasRepository } from './capas.repository';
import { mapearCapa } from './mappers/capa.mapper';
import type {
  ActualizarConfiguracionCapaDto,
} from './dto/actualizar-configuracion-capa.dto';

/**
 * Modifica la configuración compartida para el propietario
 * o un colaborador activo del proyecto.
 *
 * El cambio y el historial se confirman juntos.
 */
@Injectable()
export class CapasConfiguracionService {
  constructor(
    private readonly database: DatabaseService,
    /*private readonly proyectos: ProyectosRepository,*/
    private readonly acceso: ProyectoAccesoRepository,
    private readonly capas: CapasRepository,
    private readonly actividades: ActividadesRepository,
  ) { }

  async actualizar(
    idProyecto: string,
    idCapa: string,
    idUsuario: string,
    datos: ActualizarConfiguracionCapaDto,
  ) {
    return this.database.withTransaction(async (client) => {
      const disponible = await this.acceso.bloquearDisponible(
        client,
        idProyecto,
        idUsuario,
      );

      if (!disponible) {
        throw new NotFoundException(
          'El proyecto no está disponible para gestionar capas.',
        );
      }

      const capa = await this.capas.actualizarConfiguracion(
        client,
        idProyecto,
        idCapa,
        {
          opacidad: datos.opacidad,
          visible: datos.visible,
          orden: datos.orden,
        },
      );

      if (!capa) {
        throw new NotFoundException('La capa no está disponible.');
      }

      await this.actividades.crear(client, {
        idProyecto,
        idActor: idUsuario,
        tipoAccion: 'CAPA_CONFIGURACION_GUARDADA',
        mensaje: `Configuración de la capa ${idCapa} guardada.`,
      });

      return mapearCapa(capa);
    });
  }
}