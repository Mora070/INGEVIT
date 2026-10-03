import {
  ConflictException,
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
  MoverCarpetaDto,
} from './dto/mover-carpeta.dto';

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


function esErrorUnicoPostgres(
  error: unknown,
): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error)
  ) {
    return false;
  }

  return (
    (
      error as {
        code?: unknown;
      }
    ).code === '23505'
  );
}


/**
 * Mueve carpetas dentro del árbol
 * jerárquico del proyecto.
 *
 * Impide:
 * - mover una carpeta dentro de sí misma;
 * - moverla dentro de cualquiera de sus descendientes;
 * - moverla hacia una carpeta de otro proyecto.
 */
@Injectable()
export class CarpetasMovimientoService {
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

  async mover(
    idProyecto: string,
    idCarpeta: string,
    idUsuario: string,
    datos: MoverCarpetaDto,
  ): Promise<CarpetaResponse> {
    try {
      return await this.database.withTransaction(
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
           * Serializamos los cambios estructurales
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

          const carpetaActual =
            await this.carpetas.bloquear(
              client,
              idProyecto,
              idCarpeta,
            );

          if (
            !carpetaActual
          ) {
            throw new NotFoundException(
              'La carpeta no existe o no pertenece al proyecto.',
            );
          }

          const idCarpetaPadre =
            datos.id_carpeta_padre ??
            null;

          /*
           * null significa mover la carpeta
           * directamente a la raíz.
           */
          if (
            idCarpetaPadre !== null
          ) {
            /*
             * Una carpeta nunca puede ser
             * su propio padre.
             */
            if (
              idCarpetaPadre ===
              idCarpeta
            ) {
              throw new ConflictException(
                'Una carpeta no puede moverse dentro de sí misma.',
              );
            }

            /*
             * Comprueba que la nueva carpeta padre
             * exista dentro del mismo proyecto.
             */
            const nuevaPadre =
              await this.carpetas.bloquear(
                client,
                idProyecto,
                idCarpetaPadre,
              );

            if (
              !nuevaPadre
            ) {
              throw new NotFoundException(
                'La carpeta de destino no existe o no pertenece al proyecto.',
              );
            }

            /*
             * Impide ciclos indirectos.
             */
            const destinoEsDescendiente =
              await this.carpetas.esDescendiente(
                client,
                idProyecto,
                idCarpeta,
                idCarpetaPadre,
              );

            if (
              destinoEsDescendiente
            ) {
              throw new ConflictException(
                'No se puede mover una carpeta dentro de uno de sus descendientes.',
              );
            }
          }

          /*
           * Si ya está exactamente en esa ubicación,
           * no hacemos UPDATE ni generamos actividad.
           */
          if (
            carpetaActual.id_carpeta_padre ===
            idCarpetaPadre
          ) {
            return mapearCarpeta(
              carpetaActual,
            );
          }

          const carpetaMovida =
            await this.carpetas.mover(
              client,
              idProyecto,
              idCarpeta,
              idCarpetaPadre,
            );

          if (
            !carpetaMovida
          ) {
            throw new NotFoundException(
              'La carpeta ya no está disponible.',
            );
          }

          /*
           * Registrar la actividad en la misma
           * transacción genera el evento CARPETAS
           * únicamente después del COMMIT.
           */
          await this.actividades.crear(
            client,
            {
              idProyecto,

              idActor:
                idUsuario,

              tipoAccion:
                'CARPETA_MOVIDA',

              mensaje:
                idCarpetaPadre === null
                  ? `Carpeta "${carpetaMovida.nombre}" movida a la raíz.`
                  : `Carpeta "${carpetaMovida.nombre}" movida a otra ubicación.`,
            },
          );

          return mapearCarpeta(
            carpetaMovida,
          );
        },
      );
    } catch (
      error:
        unknown
    ) {
      if (
        esErrorUnicoPostgres(
          error,
        )
      ) {
        throw new ConflictException(
          'Ya existe una carpeta con ese nombre en la ubicación de destino.',
        );
      }

      throw error;
    }
  }
}