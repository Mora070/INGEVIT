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
  PlanosRepository,
} from './planos.repository';

import {
  mapearPlano,
} from './mappers/plano.mapper';

import type {
  ActualizarPlanoDto,
} from './dto/actualizar-plano.dto';

import type {
  PlanoResponse,
} from './types/plano.types';

@Injectable()
export class PlanosEdicionService {
  constructor(
    private readonly database:
      DatabaseService,

    private readonly acceso:
      ProyectoAccesoRepository,

    private readonly planos:
      PlanosRepository,

    private readonly actividades:
      ActividadesRepository,

    private readonly notificaciones:
      NotificacionesRepository,
  ) {}

  async actualizarDatos(
    idProyecto: string,
    idPlano: string,
    idUsuario: string,
    datos: ActualizarPlanoDto,
  ): Promise<PlanoResponse> {
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

        const plano =
          await this.planos.actualizarDatos(
            client,
            idProyecto,
            idPlano,
            {
              titulo:
                datos.titulo,

              descripcion:
                datos.descripcion,
            },
          );

        if (
          plano ===
          null
        ) {
          throw new NotFoundException(
            'El plano no está disponible.',
          );
        }

        await this.actividades.crear(
          client,
          {
            idProyecto,

            idActor:
              idUsuario,

            tipoAccion:
              'PLANO_DATOS_GUARDADOS',

            mensaje:
              `Datos del plano ${plano.id_plano} guardados.`,
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
              null,

            tipo:
              'PLANO_EDITADO',

            titulo:
              'Plano actualizado',

            mensaje:
              `Se actualizó el plano "${plano.titulo}".`,

            destino:
              'PLANOS',

            id_recurso:
              plano.id_plano,
          },
        );

        return mapearPlano(
          plano,
        );
      },
    );
  }
}