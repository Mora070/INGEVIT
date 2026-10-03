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
  ActualizarCarpetaDto,
} from './dto/actualizar-carpeta.dto';

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
 * Modifica datos editables de una carpeta.
 *
 * Por ahora permite únicamente renombrarla.
 */
@Injectable()
export class CarpetasActualizacionService {
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

  async renombrar(
    idProyecto: string,
    idCarpeta: string,
    idUsuario: string,
    datos: ActualizarCarpetaDto,
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
           * Bloqueamos la carpeta antes de modificarla.
           *
           * También confirma que pertenece
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

          /*
           * Si el nombre realmente no cambió,
           * evitamos una actualización y un evento
           * de tiempo real innecesarios.
           */
          if (
            actual.nombre ===
            datos.nombre
          ) {
            return mapearCarpeta(
              actual,
            );
          }

          const carpeta =
            await this.carpetas.actualizarNombre(
              client,
              idProyecto,
              idCarpeta,
              datos.nombre,
            );

          if (
            !carpeta
          ) {
            throw new NotFoundException(
              'La carpeta ya no está disponible.',
            );
          }

          /*
           * La actividad se registra dentro de
           * la misma transacción.
           *
           * ActividadesRepository traduce
           * CARPETA_NOMBRE_GUARDADO a CARPETAS
           * y PostgreSQL emitirá proyecto_cambios
           * únicamente después del COMMIT.
           */
          await this.actividades.crear(
            client,
            {
              idProyecto,

              idActor:
                idUsuario,

              tipoAccion:
                'CARPETA_NOMBRE_GUARDADO',

              mensaje:
                `Carpeta "${actual.nombre}" renombrada a "${carpeta.nombre}".`,
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
       * Los índices únicos impiden repetir
       * nombres dentro de la misma ubicación.
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