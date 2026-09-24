import {
  ConflictException, Injectable, NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ProyectosRepository } from '../proyectos/proyectos.repository';
import { ActividadesRepository } from '../actividades/actividades.repository';
import { CapasReintentoRepository } from './capas-reintento.repository';

/**
 * Devuelve a la cola una capa fallida conservando el original y su configuración.
 * No ejecuta GIS en la petición HTTP ni modifica capas que siguen PROCESANDO.
 * La transición y el historial se confirman en una misma transacción.
 */
@Injectable()
export class CapasReintentoService {
  constructor(
    private readonly database: DatabaseService,
    private readonly proyectos: ProyectosRepository,
    private readonly capas: CapasReintentoRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  async solicitar(proyecto: string, capa: string, usuario: string) {
    return this.database.withTransaction(async client => {
      if (!await this.proyectos.bloquearPropietarioActivo(client, usuario)) {
        throw new UnauthorizedException('La sesión no es válida o la cuenta no está activa.');
      }
      if (!await this.proyectos.bloquearEditablePorPropietario(client, proyecto, usuario)) {
        throw new NotFoundException('El proyecto no está disponible para gestionar capas.');
      }
      const fila = await this.capas.bloquear(client, proyecto, capa);
      if (!fila) throw new NotFoundException('La capa no está disponible.');
      if (fila.estado_procesamiento !== 'ERROR'
          || fila.almacenamiento_proveedor !== 'LOCAL'
          || fila.teselas_version !== null || fila.procesamiento_token !== null) {
        throw new ConflictException('Solo se pueden reintentar capas fallidas sin un intento activo ni una versión publicada.');
      }
      if (!await this.capas.encolar(client, proyecto, capa)) {
        throw new ConflictException('La capa ya no está disponible para reintentar.');
      }
      await this.actividades.crear(client, {
        idProyecto: proyecto, idActor: usuario,
        tipoAccion: 'CAPA_REINTENTO_SOLICITADO',
        mensaje: `Se solicitó un nuevo procesamiento de la capa ${capa}.`,
      });
      return { id_capa: fila.id_capa, estado_procesamiento: 'PENDIENTE' as const };
    });
  }
}
