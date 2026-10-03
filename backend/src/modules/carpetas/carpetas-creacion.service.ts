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
  CrearCarpetaDto,
} from './dto/crear-carpeta.dto';

import type {
  CarpetaResponse,
  CarpetaRow,
} from './types/carpeta.types';


/**
 * Convierte el registro interno de PostgreSQL
 * a la representación pública de una carpeta.
 */
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
 * Comprueba si el error corresponde a una
 * violación de unicidad de PostgreSQL.
 */
function esErrorUnicoPostgres(
  error: unknown,
): boolean {
  if (
    typeof error !== 'object' ||
    error === null
  ) {
    return false;
  }

  if (
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
 * Crea carpetas y subcarpetas dentro
 * de proyectos disponibles para el usuario.
 */
@Injectable()
export class CarpetasCreacionService {
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

  async crear(
    idProyecto: string,
    idUsuario: string,
    datos: CrearCarpetaDto,
  ): Promise<CarpetaResponse> {
    try {
      return await this.database.withTransaction(
        async (
          client,
        ) => {
          /*
           * Comprueba que el usuario tenga acceso
           * activo al proyecto.
           *
           * Puede ser propietario o colaborador.
           */
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

          const idCarpetaPadre =
            datos.id_carpeta_padre ??
            null;

          /*
           * Si se está creando una subcarpeta,
           * comprobamos que la carpeta padre exista
           * dentro del mismo proyecto.
           */
          if (
            idCarpetaPadre !==
            null
          ) {
            const carpetaPadre =
              await this.carpetas.bloquear(
                client,
                idProyecto,
                idCarpetaPadre,
              );

            if (
              !carpetaPadre
            ) {
              throw new NotFoundException(
                'La carpeta padre no existe o no pertenece al proyecto.',
              );
            }
          }

          const carpeta =
            await this.carpetas.crear(
              client,
              {
                idProyecto,

                idCarpetaPadre,

                idUsuarioCreacion:
                  idUsuario,

                nombre:
                  datos.nombre,
              },
            );

          /*
           * Registrar la actividad dentro de la misma
           * transacción también genera el evento
           * PostgreSQL CARPETAS después del COMMIT.
           */
          await this.actividades.crear(
            client,
            {
              idProyecto,

              idActor:
                idUsuario,

              tipoAccion:
                'CARPETA_CREADA',

              mensaje:
                `Carpeta "${carpeta.nombre}" creada.`,
            },
          );

          return mapearCarpeta(
            carpeta,
          );
        },
      );
    } catch (
      error:
        unknown
    ) {
      /*
       * Los índices únicos de obra.carpetas
       * impiden nombres repetidos:
       *
       * - en la raíz del mismo proyecto;
       * - dentro de la misma carpeta padre.
       */
      if (
        esErrorUnicoPostgres(
          error,
        )
      ) {
        throw new ConflictException(
          'Ya existe una carpeta con ese nombre en esta ubicación.',
        );
      }

      throw error;
    }
  }
}