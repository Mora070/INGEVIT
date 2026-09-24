import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import { ProyectosRepository } from '../proyectos/proyectos.repository';
import { ActividadesRepository } from '../actividades/actividades.repository';
import { CapasEliminacionRepository } from './capas-eliminacion.repository';

/**
 * Retira una capa y registra su limpieza en la misma transacción.
 * Solo permite la operación al propietario activo.
 */
@Injectable()
export class CapasEliminacionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly proyectos: ProyectosRepository,
    private readonly capas: CapasEliminacionRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  async eliminar(
    proyecto: string,
    capa: string,
    usuario: string,
  ): Promise<void> {
    await this.database.withTransaction(async client => {
      if (!await this.proyectos.bloquearPropietarioActivo(client, usuario)) {
        throw new UnauthorizedException(
          'La sesión no es válida o la cuenta no está activa.',
        );
      }

      if (!await this.proyectos.bloquearEditablePorPropietario(
        client,
        proyecto,
        usuario,
      )) {
        throw new NotFoundException(
          'El proyecto no está disponible para gestionar capas.',
        );
      }

      const fila = await this.capas.bloquear(client, proyecto, capa);

      if (!fila) {
        throw new NotFoundException('La capa no está disponible.');
      }

      if (fila.estado_procesamiento === 'PROCESANDO') {
        throw new ConflictException(
          'La capa está procesándose. Espera a que termine el intento.',
        );
      }

      if (
        fila.almacenamiento_proveedor !== 'LOCAL'
        || (
          fila.teselas_version !== null
          && fila.teselas_proveedor !== 'LOCAL'
        )
      ) {
        throw new ConflictException(
          'La eliminación de este proveedor todavía no está disponible.',
        );
      }

      // Si cualquiera de estas operaciones falla, se revierte todo.
      await this.capas.registrar(client, fila);
      await this.capas.eliminar(client, proyecto, capa);

      await this.actividades.crear(client, {
        idProyecto: proyecto,
        idActor: usuario,
        tipoAccion: 'CAPA_ELIMINADA',
        mensaje: `Se eliminó la capa ${capa}.`,
      });
    });
  }
}