import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  DatabaseService,
} from '../../database/database.service';

import {
  ActividadesRepository,
} from '../actividades/actividades.repository';

import {
  CarpetasAccesoRepository,
} from './carpetas-acceso.repository';

import {
  CarpetasRepository,
} from './carpetas.repository';

import type {
  CarpetaResponse,
  CarpetaRow,
} from './types/carpeta.types';


function mapearCarpeta(
  carpeta: CarpetaRow,
): CarpetaResponse {
  return {
    id_carpeta:
      carpeta.id_carpeta,

    id_proyecto:
      carpeta.id_proyecto,

    id_carpeta_padre:
      carpeta.id_carpeta_padre,

    id_usuario_creacion:
      carpeta.id_usuario_creacion,

    nombre:
      carpeta.nombre,

    fecha_creacion:
      carpeta.fecha_creacion
        .toISOString(),

    fecha_actualizacion:
      carpeta.fecha_actualizacion
        .toISOString(),
  };
}


/**
 * Elimina carpetas del árbol organizativo.
 *
 * La eliminación de una carpeta también elimina:
 * - sus subcarpetas;
 * - sus asociaciones con fotografías;
 * - sus asociaciones con panorámicas;
 * - sus asociaciones con planos.
 *
 * Los recursos originales permanecen intactos.
 */
@Injectable()
export class CarpetasEliminacionService {
  constructor(
    private readonly database:
      DatabaseService,

    private readonly acceso:
      CarpetasAccesoRepository,

    private readonly carpetas:
      CarpetasRepository,

    private readonly actividades:
      ActividadesRepository,
  ) {}

  async eliminar(
    idProyecto: string,
    idCarpeta: string,
    idUsuario: string,
  ): Promise<CarpetaResponse> {
    return this.database.withTransaction(
      async (
        client,
      ) => {
        const disponible =
          await this.acceso.bloquearDisponible(
            client,
            idProyecto,
            idUsuario,
          );

        if (
          !disponible
        ) {
          throw new NotFoundException(
            'El proyecto no está disponible para gestionar carpetas.',
          );
        }

        /*
         * Serializamos cambios estructurales
         * del árbol del proyecto.
         */
        const estructuraDisponible =
          await this.carpetas.bloquearEstructuraProyecto(
            client,
            idProyecto,
          );

        if (
          !estructuraDisponible
        ) {
          throw new NotFoundException(
            'El proyecto no está disponible.',
          );
        }

        /*
         * Bloqueamos primero la carpeta objetivo.
         *
         * Esto también confirma que pertenece
         * al proyecto indicado.
         */
        const actual =
          await this.carpetas.bloquear(
            client,
            idProyecto,
            idCarpeta,
          );

        if (
          !actual
        ) {
          throw new NotFoundException(
            'La carpeta no existe o no pertenece al proyecto.',
          );
        }

        const eliminada =
          await this.carpetas.eliminar(
            client,
            idProyecto,
            idCarpeta,
          );

        if (
          !eliminada
        ) {
          throw new NotFoundException(
            'La carpeta ya no está disponible.',
          );
        }

        /*
         * Esta actividad se registra después de
         * eliminar la estructura, pero dentro
         * de la misma transacción.
         *
         * ActividadesRepository convertirá
         * CARPETA_ELIMINADA en CARPETAS.
         */
        await this.actividades.crear(
          client,
          {
            idProyecto,

            idActor:
              idUsuario,

            tipoAccion:
              'CARPETA_ELIMINADA',

            mensaje:
              `Carpeta "${actual.nombre}" eliminada.`,
          },
        );

        return mapearCarpeta(
          eliminada,
        );
      },
    );
  }
}