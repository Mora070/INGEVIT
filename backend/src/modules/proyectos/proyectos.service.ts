import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import {
  ProyectosRepository,
} from './proyectos.repository';

import {
  toProyectoResponse,
} from './mappers/proyecto.mapper';

import type {
  ListarProyectosQueryDto,
} from './dto/listar-proyectos-query.dto';

import type {
  ProyectoResponse,
} from './types/proyecto.types';

import type {
  ProyectosPaginadosResponse,
} from './types/proyectos-paginados.types';

import {
  DatabaseService,
} from '../../database/database.service';

import {
  ActividadesRepository,
} from '../actividades/actividades.repository';

import {
  NotificacionesRepository,
} from '../notificaciones/notificaciones.repository';

import type {
  CrearProyectoDto,
} from './dto/crear-proyecto.dto';

import type {
  ActualizarProyectoDto,
} from './dto/actualizar-proyecto.dto';

import type {
  ParticipanteProyectoResponse,
} from './types/participante-proyecto.types';

import {
  mapearParticipanteProyecto,
} from './mappers/participante-proyecto.mapper';

import {
  toProyectoListadoResponse,
} from './mappers/proyecto-listado.mapper';

/**
 * Coordina los casos de uso de proyectos.
 *
 * El repositorio aplica los filtros de acceso en PostgreSQL.
 * El mapper construye cada proyecto de la respuesta.
 */
@Injectable()
export class ProyectosService {
  constructor(
    private readonly proyectosRepository:
      ProyectosRepository,

    private readonly database:
      DatabaseService,

    private readonly actividadesRepository:
      ActividadesRepository,

    private readonly notificacionesRepository:
      NotificacionesRepository,
  ) {}

  /**
   * Obtiene una página de proyectos accesibles para el solicitante.
   */
  async listarDisponibles(
    idUsuarioAutenticado: string,
    consulta: ListarProyectosQueryDto,
  ): Promise<ProyectosPaginadosResponse> {
    const {
      pagina,
      limite,
      busqueda,
    } = consulta;

    const resultado =
      await this.proyectosRepository
        .findDisponiblesPaginadosByUsuario(
          idUsuarioAutenticado,
          pagina,
          limite,
          busqueda,
        );

    return {
      proyectos:
        resultado.proyectos.map(
          toProyectoListadoResponse,
        ),

      pagina,

      limite,

      total:
        resultado.total,

      total_paginas:
        Math.ceil(
          resultado.total /
            limite,
        ),
    };
  }

  /**
   * Obtiene el detalle de un proyecto accesible para el solicitante.
   */
  async obtenerDetalle(
    idProyecto: string,
    idUsuarioAutenticado: string,
  ): Promise<ProyectoResponse> {
    const proyecto =
      await this.proyectosRepository.findDisponibleById(
        idProyecto,
        idUsuarioAutenticado,
      );

    if (
      proyecto ===
      null
    ) {
      throw new NotFoundException(
        'El proyecto no está disponible.',
      );
    }

    return toProyectoResponse(
      proyecto,
    );
  }

  /**
   * Crea el proyecto y registra su actividad de forma atómica.
   */
  async crear(
    idUsuarioAutenticado: string,
    datos: CrearProyectoDto,
  ): Promise<ProyectoResponse> {
    return this.database.withTransaction(
      async (
        client,
      ) => {
        const propietarioActivo =
          await this.proyectosRepository.bloquearPropietarioActivo(
            client,
            idUsuarioAutenticado,
          );

        if (
          !propietarioActivo
        ) {
          throw new UnauthorizedException(
            'La sesión no es válida o la cuenta no está activa.',
          );
        }

        const proyecto =
          await this.proyectosRepository.crear(
            client,
            {
              idPropietario:
                idUsuarioAutenticado,

              nombre:
                datos.nombre,

              descripcion:
                datos.descripcion,

              direccion:
                datos.direccion,

              contratante:
                datos.contratante,

              fechaInicio:
                datos.fecha_inicio,

              fechaFinalizacion:
                datos.fecha_finalizacion ??
                null,

              estadoProyecto:
                datos.estado_proyecto,

              latitud:
                datos.latitud ??
                null,

              longitud:
                datos.longitud ??
                null,
            },
          );

        await this.actividadesRepository.crear(
          client,
          {
            idProyecto:
              proyecto.id_proyecto,

            idActor:
              idUsuarioAutenticado,

            tipoAccion:
              'PROYECTO_CREADO',

            mensaje:
              'Proyecto creado.',
          },
        );

        return toProyectoResponse(
          proyecto,
        );
      },
    );
  }

  /**
   * Reemplaza los datos editables de un proyecto.
   *
   * También registra la actividad y notifica a los demás
   * participantes activos del proyecto.
   */
  async actualizar(
    idProyecto: string,
    idUsuarioAutenticado: string,
    datos: ActualizarProyectoDto,
  ): Promise<ProyectoResponse> {
    return this.database.withTransaction(
      async (
        client,
      ) => {
        const propietarioActivo =
          await this.proyectosRepository.bloquearPropietarioActivo(
            client,
            idUsuarioAutenticado,
          );

        if (
          !propietarioActivo
        ) {
          throw new UnauthorizedException(
            'La sesión no es válida o la cuenta no está activa.',
          );
        }

        const proyectoEditable =
          await this.proyectosRepository.bloquearEditablePorPropietario(
            client,
            idProyecto,
            idUsuarioAutenticado,
          );

        if (
          proyectoEditable ===
          null
        ) {
          throw new NotFoundException(
            'El proyecto no está disponible para edición.',
          );
        }

        const proyectoActualizado =
          await this.proyectosRepository.actualizar(
            client,
            idProyecto,
            idUsuarioAutenticado,
            {
              nombre:
                datos.nombre,

              descripcion:
                datos.descripcion,

              direccion:
                datos.direccion,

              contratante:
                datos.contratante,

              fechaInicio:
                datos.fecha_inicio,

              fechaFinalizacion:
                datos.fecha_finalizacion ??
                null,

              estadoProyecto:
                datos.estado_proyecto,

              latitud:
                datos.latitud ??
                null,

              longitud:
                datos.longitud ??
                null,
            },
          );

        await this.actividadesRepository.crear(
          client,
          {
            idProyecto:
              proyectoActualizado.id_proyecto,

            idActor:
              idUsuarioAutenticado,

            tipoAccion:
              'PROYECTO_MODIFICADO',

            mensaje:
              'Datos del proyecto actualizados.',
          },
        );

        await this.notificacionesRepository.crearParaParticipantesProyecto(
          client,
          {
            id_actor:
              idUsuarioAutenticado,

            id_proyecto:
              idProyecto,

            id_incidencia:
              null,

            tipo:
              'PROYECTO_MODIFICADO',

            titulo:
              'Proyecto actualizado',

            mensaje:
              `Se actualizaron los datos del proyecto "${proyectoActualizado.nombre}".`,

            destino:
              'RESUMEN',

            id_recurso:
              null,
          },
        );

        return toProyectoResponse(
          proyectoActualizado,
        );
      },
    );
  }

  /**
   * Elimina lógicamente un proyecto por solicitud de su propietario.
   */
  async eliminarLogicamente(
    idProyecto: string,
    idUsuarioAutenticado: string,
  ): Promise<void> {
    await this.database.withTransaction(
      async (
        client,
      ) => {
        const propietarioActivo =
          await this.proyectosRepository.bloquearPropietarioActivo(
            client,
            idUsuarioAutenticado,
          );

        if (
          !propietarioActivo
        ) {
          throw new UnauthorizedException(
            'La sesión no es válida o la cuenta no está activa.',
          );
        }

        const proyecto =
          await this.proyectosRepository.bloquearEditablePorPropietario(
            client,
            idProyecto,
            idUsuarioAutenticado,
          );

        if (
          proyecto ===
          null
        ) {
          throw new NotFoundException(
            'El proyecto no está disponible para eliminación.',
          );
        }

        await this.proyectosRepository.eliminarLogicamente(
          client,
          idProyecto,
          idUsuarioAutenticado,
        );

        await this.actividadesRepository.crear(
          client,
          {
            idProyecto,

            idActor:
              idUsuarioAutenticado,

            tipoAccion:
              'PROYECTO_ELIMINADO_LOGICAMENTE',

            mensaje:
              'Proyecto eliminado lógicamente.',
          },
        );
      },
    );
  }

  /**
   * Agrega un usuario existente como colaborador del proyecto.
   */
  async agregarColaborador(
    idProyecto: string,
    idUsuarioAutenticado: string,
    idColaborador: string,
  ): Promise<void> {
    await this.database.withTransaction(
      async (
        client,
      ) => {
        const propietarioActivo =
          await this.proyectosRepository.bloquearPropietarioActivo(
            client,
            idUsuarioAutenticado,
          );

        if (
          !propietarioActivo
        ) {
          throw new UnauthorizedException(
            'La sesión no es válida o la cuenta no está activa.',
          );
        }

        const proyecto =
          await this.proyectosRepository.bloquearEditablePorPropietario(
            client,
            idProyecto,
            idUsuarioAutenticado,
          );

        if (
          proyecto ===
          null
        ) {
          throw new NotFoundException(
            'El proyecto no está disponible para gestionar colaboradores.',
          );
        }

        const usuarioExiste =
          await this.proyectosRepository.bloquearUsuarioExistente(
            client,
            idColaborador,
          );

        if (
          !usuarioExiste
        ) {
          throw new NotFoundException(
            'El usuario que deseas agregar no existe.',
          );
        }

        const agregado =
          await this.proyectosRepository.agregarColaborador(
            client,
            idProyecto,
            idColaborador,
          );

        if (
          !agregado
        ) {
          return;
        }

        await this.actividadesRepository.crear(
          client,
          {
            idProyecto,

            idActor:
              idUsuarioAutenticado,

            tipoAccion:
              'COLABORADOR_AGREGADO',

            mensaje:
              `Usuario ${idColaborador} agregado como colaborador.`,
          },
        );

        await this.notificacionesRepository.crearParaParticipantesProyecto(
          client,
          {
            id_actor:
              idUsuarioAutenticado,

            id_proyecto:
              idProyecto,

            id_incidencia:
              null,

            tipo:
              'COLABORADOR_AGREGADO',

            titulo:
              'Colaborador agregado',

            mensaje:
              'Se agregó un nuevo colaborador al proyecto.',

            destino:
              'RESUMEN',

            id_recurso:
              null,
          },
        );
      },
    );
  }

  /**
   * Retira a un colaborador del proyecto.
   *
   * Además:
   * - registra la actividad;
   * - notifica directamente al usuario retirado;
   * - notifica a los participantes que continúan en el proyecto.
   */
  async retirarColaborador(
    idProyecto: string,
    idActor: string,
    idColaborador: string,
  ): Promise<void> {
    await this.database.withTransaction(
      async (
        client,
      ) => {
        const actorActivo =
          await this.proyectosRepository.bloquearPropietarioActivo(
            client,
            idActor,
          );

        if (
          !actorActivo
        ) {
          throw new UnauthorizedException(
            'La sesión no es válida o la cuenta no está activa.',
          );
        }

        const proyecto =
          await this.proyectosRepository.bloquearEditablePorPropietario(
            client,
            idProyecto,
            idActor,
          );

        if (
          !proyecto
        ) {
          throw new NotFoundException(
            'El proyecto no está disponible para gestionar colaboradores.',
          );
        }

        const retirado =
          await this.proyectosRepository.retirarColaborador(
            client,
            idProyecto,
            idColaborador,
          );

        if (
          !retirado
        ) {
          return;
        }

        await this.actividadesRepository.crear(
          client,
          {
            idProyecto,

            idActor,

            tipoAccion:
              'COLABORADOR_RETIRADO',

            mensaje:
              `Usuario ${idColaborador} retirado como colaborador.`,
          },
        );

        /*
         * Aviso directo para la persona que acaba de perder
         * el acceso al proyecto.
         */
        await this.notificacionesRepository.crearRetiroColaborador(
          client,
          idActor,
          idProyecto,
          idColaborador,
        );

        /*
         * Aviso para los participantes que todavía conservan
         * acceso al proyecto.
         */
        await this.notificacionesRepository.crearParaParticipantesProyecto(
          client,
          {
            id_actor:
              idActor,

            id_proyecto:
              idProyecto,

            id_incidencia:
              null,

            tipo:
              'COLABORADOR_RETIRADO',

            titulo:
              'Colaborador retirado',

            mensaje:
              'Se retiró un colaborador del proyecto.',

            destino:
              'COLABORADORES',

            id_recurso:
              null,
          },
        );
      },
    );
  }

  /**
   * Devuelve los participantes de un proyecto disponible para el solicitante.
   */
  async listarParticipantes(
    idProyecto: string,
    idUsuario: string,
  ): Promise<ParticipanteProyectoResponse[]> {
    const participantes =
      await this.proyectosRepository.findParticipantesDisponibles(
        idProyecto,
        idUsuario,
      );

    if (
      participantes.length ===
      0
    ) {
      throw new NotFoundException(
        'El proyecto no está disponible.',
      );
    }

    return participantes.map(
      mapearParticipanteProyecto,
    );
  }
}