import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

import {
  ActividadesRepository,
} from '../actividades/actividades.repository';

import {
  FotografiasAccesoRepository,
} from './fotografias-acceso.repository';

import {
  FotografiasRepository,
} from './fotografias.repository';

import {
  mapearFotografia,
} from './mappers/fotografia.mapper';

import type {
  ActualizarTituloFotografiaDto,
} from './dto/actualizar-titulo-fotografia.dto';

import type {
  FotografiaResponse,
} from './types/fotografia.types';

/**
 * Coordina la edición de metadatos de fotografías.
 *
 * La autorización, la actualización y la actividad utilizan
 * la misma conexión y transacción.
 *
 * No abre ni modifica archivos de almacenamiento.
 */
@Injectable()
export class FotografiasEdicionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly acceso: FotografiasAccesoRepository,
    private readonly fotografias: FotografiasRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  /**
   * Guarda el título de una fotografía del proyecto.
   *
   * idUsuario debe proceder de la sesión autenticada.
   * datos debe haber pasado la validación del DTO.
   *
   * El autor original de la fotografía se conserva.
   * La actividad identifica al usuario que realiza este guardado.
   */
  async actualizarTitulo(
    idProyecto: string,
    idFotografia: string,
    idUsuario: string,
    datos: ActualizarTituloFotografiaDto,
  ): Promise<FotografiaResponse> {
    return this.database.withTransaction(async (client) => {
      /*
       * Reutilizamos la autorización con bloqueo para coordinar
       * la operación con cambios de disponibilidad o colaboradores.
       */
      const disponible = await this.acceso.bloquearDisponible(
        client,
        idProyecto,
        idUsuario,
      );

      if (!disponible) {
        throw new NotFoundException(
          'El proyecto no está disponible.',
        );
      }

      const fotografia = await this.fotografias.actualizarTitulo(
        client,
        idProyecto,
        idFotografia,
        datos.titulo,
      );

      if (fotografia === null) {
        throw new NotFoundException(
          'La fotografía no está disponible.',
        );
      }

      /*
       * Si este registro falla, DatabaseService intenta revertir
       * también la actualización del título.
       *
       * No incluimos el título enviado por el usuario en el mensaje.
       */
      await this.actividades.crear(client, {
        idProyecto,
        idActor: idUsuario,
        tipoAccion: 'FOTOGRAFIA_TITULO_GUARDADO',
        mensaje: `Título de la fotografía ${fotografia.id_fotografia} guardado.`,
      });

      // Devuelve únicamente los campos públicos de la fotografía.
      return mapearFotografia(fotografia);
    });
  }
}