import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  DatabaseService,
} from '../../database/database.service';

import {
  ProyectoAccesoRepository,
} from '../../common/repositories/proyecto-acceso.repository';

import {
  ActividadesRepository,
} from '../actividades/actividades.repository';

import {
  NotificacionesRepository,
} from '../notificaciones/notificaciones.repository';

import {
  IncidenciasRepository,
} from './incidencias.repository';

import {
  mapearIncidenciaMapa,
} from './mappers/incidencia-mapa.mapper';

import type {
  ActualizarIncidenciaMapaDto,
} from './dto/actualizar-incidencia-mapa.dto';

import type {
  IncidenciaMapaResponse,
} from './mappers/incidencia-mapa.mapper';

/**
 * Actualiza una incidencia ubicada
 * directamente sobre el mapa.
 *
 * Permite modificar:
 * - título;
 * - descripción;
 * - prioridad;
 * - estado;
 * - ubicación.
 *
 * Conserva:
 * - creador;
 * - fotografía;
 * - panorámica;
 * - fecha de creación.
 */
@Injectable()
export class IncidenciasMapaEdicionService {
  constructor(
    private readonly database:
      DatabaseService,

    private readonly acceso:
      ProyectoAccesoRepository,

    private readonly incidencias:
      IncidenciasRepository,

    private readonly actividades:
      ActividadesRepository,

    private readonly notificaciones:
      NotificacionesRepository,
  ) {}

  async actualizarDatos(
    idProyecto: string,
    idIncidencia: string,
    idUsuario: string,
    datos: ActualizarIncidenciaMapaDto,
  ): Promise<IncidenciaMapaResponse> {
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
            'El proyecto no está disponible.',
          );
        }

        const incidencia =
          await this.incidencias.actualizarDatosEnMapa(
            client,
            idProyecto,
            idIncidencia,
            {
              titulo:
                datos.titulo,

              descripcion:
                datos.descripcion,

              prioridad:
                datos.prioridad,

              estado:
                datos.estado,

              latitud:
                datos.latitud,

              longitud:
                datos.longitud,
            },
          );

        if (
          incidencia ===
          null
        ) {
          throw new NotFoundException(
            'La incidencia no está disponible.',
          );
        }

        await this.actividades.crear(
          client,
          {
            idProyecto,

            idActor:
              idUsuario,

            tipoAccion:
              'INCIDENCIA_DATOS_GUARDADOS',

            mensaje:
              `Datos de la incidencia ${incidencia.id_incidencia} guardados.`,
          },
        );

        await this.notificaciones.crearParaParticipantesProyecto(
          client,
          {
            id_actor:
              idUsuario,

            id_proyecto:
              idProyecto,

            id_incidencia:
              incidencia.id_incidencia,

            tipo:
              'INCIDENCIA_EDITADA',

            titulo:
              'Incidencia actualizada',

            mensaje:
              `Se actualizó la incidencia "${incidencia.titulo}".`,

            destino:
              'MAPA',

            id_recurso:
              incidencia.id_incidencia,
          },
        );

        return mapearIncidenciaMapa(
          incidencia,
        );
      },
    );
  }
}