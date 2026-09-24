import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import { ProyectosRepository } from '../proyectos/proyectos.repository';
import { ActividadesRepository } from '../actividades/actividades.repository';

import { CapasRepository } from './capas.repository';
import { mapearCapa } from './mappers/capa.mapper';
import type {
  ActualizarConfiguracionCapaDto,
} from './dto/actualizar-configuracion-capa.dto';

/**
 * Modifica la configuración compartida exclusivamente como propietario.
 *
 * Reutiliza el orden de bloqueos de gestión del proyecto:
 * cuenta del propietario -> proyecto -> capa.
 *
 * El cambio y el historial se confirman juntos.
 */
@Injectable()
export class CapasConfiguracionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly proyectos: ProyectosRepository,
    private readonly capas: CapasRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  async actualizar(
    idProyecto: string,
    idCapa: string,
    idUsuario: string,
    datos: ActualizarConfiguracionCapaDto,
  ) {
    return this.database.withTransaction(async (client) => {
      const activo = await this.proyectos.bloquearPropietarioActivo(
        client,
        idUsuario,
      );

      if (!activo) {
        throw new UnauthorizedException(
          'La sesión no es válida o la cuenta no está activa.',
        );
      }

      const proyecto = await this.proyectos.bloquearEditablePorPropietario(
        client,
        idProyecto,
        idUsuario,
      );

      if (!proyecto) {
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