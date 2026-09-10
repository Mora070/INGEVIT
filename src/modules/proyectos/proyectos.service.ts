import { Injectable, NotFoundException, UnauthorizedException, } from '@nestjs/common';

import { ProyectosRepository } from './proyectos.repository';
import { toProyectoResponse } from './mappers/proyecto.mapper';
import type { ListarProyectosQueryDto } from './dto/listar-proyectos-query.dto';
import type { ProyectoResponse } from './types/proyecto.types';
import type { ProyectosPaginadosResponse } from './types/proyectos-paginados.types';
import { DatabaseService } from '../../database/database.service';
import { ActividadesRepository } from '../actividades/actividades.repository';
import type { CrearProyectoDto } from './dto/crear-proyecto.dto';
import type { ActualizarProyectoDto } from './dto/actualizar-proyecto.dto';

/**
 * Coordina los casos de uso de proyectos.
 *
 * El repositorio aplica los filtros de acceso en PostgreSQL.
 * El mapper construye cada proyecto de la respuesta.
 */
@Injectable()
export class ProyectosService {
  constructor(
    private readonly proyectosRepository: ProyectosRepository,
    private readonly database: DatabaseService,
    private readonly actividadesRepository: ActividadesRepository,
  ) { }

  /**
   * Obtiene una página de proyectos accesibles para el solicitante.
   *
   * Precondiciones:
   * - El identificador procede de AuthGuard.
   * - Los parámetros fueron validados con ListarProyectosQueryDto.
   *
   * No acepta un rol ni un propietario alternativo para ampliar
   * el acceso del solicitante.
   *
   * Una página sin resultados es válida y conserva el total.
   */
  async listarDisponibles(
    idUsuarioAutenticado: string,
    consulta: ListarProyectosQueryDto,
  ): Promise<ProyectosPaginadosResponse> {
    const { pagina, limite } = consulta;

    const resultado =
      await this.proyectosRepository.findDisponiblesPaginadosByUsuario(
        idUsuarioAutenticado,
        pagina,
        limite,
      );

    return {
      proyectos: resultado.proyectos.map(toProyectoResponse),
      pagina,
      limite,
      total: resultado.total,
      total_paginas: Math.ceil(resultado.total / limite),
    };
  }


  /**
   * Obtiene el detalle de un proyecto accesible para el solicitante.
   *
   * Precondiciones:
   * - idProyecto fue validado como UUID en la ruta.
   * - idUsuarioAutenticado procede de AuthGuard.
   *
   * El repositorio comprueba disponibilidad y pertenencia.
   * No diferenciamos entre un proyecto inexistente y uno no accesible.
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

    if (proyecto === null) {
      throw new NotFoundException(
        'El proyecto no está disponible.',
      );
    }

    return toProyectoResponse(proyecto);
  }
  /**
   * Crea el proyecto y registra su actividad de forma atómica.
   *
   * Precondiciones:
   * - idUsuarioAutenticado procede de AuthGuard.
   * - datos fue validado con CrearProyectoDto.
   *
   * El propietario y el actor se obtienen de la misma identidad.
   * No se crea una relación adicional en usuario_proyecto.
   */
  async crear(
    idUsuarioAutenticado: string,
    datos: CrearProyectoDto,
  ): Promise<ProyectoResponse> {
    return this.database.withTransaction(async (client) => {
      const propietarioActivo =
        await this.proyectosRepository.bloquearPropietarioActivo(
          client,
          idUsuarioAutenticado,
        );

      if (!propietarioActivo) {
        throw new UnauthorizedException(
          'La sesión no es válida o la cuenta no está activa.',
        );
      }

      /**
       * Enumeramos los campos admitidos.
       * La propiedad del proyecto no procede del cuerpo HTTP.
       */
      const proyecto = await this.proyectosRepository.crear(
        client,
        {
          idPropietario: idUsuarioAutenticado,
          nombre: datos.nombre,
          descripcion: datos.descripcion,
          direccion: datos.direccion,
          contratante: datos.contratante,
          fechaInicio: datos.fecha_inicio,
          fechaFinalizacion: datos.fecha_finalizacion ?? null,
          estadoProyecto: datos.estado_proyecto,
          latitud: datos.latitud ?? null,
          longitud: datos.longitud ?? null,
        },
      );

      await this.actividadesRepository.crear(client, {
        idProyecto: proyecto.id_proyecto,
        idActor: idUsuarioAutenticado,
        tipoAccion: 'PROYECTO_CREADO',
        mensaje: 'Proyecto creado.',
      });

      /**
       * Construimos la respuesta antes de confirmar.
       * Si el mapper detecta datos inválidos, también se revierte.
       *
       * withTransaction devuelve este resultado solo después
       * de completar COMMIT.
       */
      return toProyectoResponse(proyecto);
    });
  }


  /**
   * Reemplaza los datos editables de un proyecto y registra la acción.
   *
   * Precondiciones:
   * - idProyecto fue validado como UUID.
   * - idUsuarioAutenticado procede de AuthGuard.
   * - datos fue validado con ActualizarProyectoDto.
   *
   * Orden de la operación:
   * 1. Comprobar y bloquear la cuenta activa.
   * 2. Comprobar propiedad y bloquear el proyecto.
   * 3. Actualizar sus datos.
   * 4. Registrar la actividad.
   *
   * Todas las operaciones utilizan el mismo cliente transaccional.
   */
  async actualizar(
    idProyecto: string,
    idUsuarioAutenticado: string,
    datos: ActualizarProyectoDto,
  ): Promise<ProyectoResponse> {
    return this.database.withTransaction(async (client) => {
      const propietarioActivo =
        await this.proyectosRepository.bloquearPropietarioActivo(
          client,
          idUsuarioAutenticado,
        );

      if (!propietarioActivo) {
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

      if (proyectoEditable === null) {
        throw new NotFoundException(
          'El proyecto no está disponible para edición.',
        );
      }

      /**
       * Enumeramos los campos admitidos.
       * El propietario y la eliminación lógica no pueden modificarse
       * mediante esta operación.
       *
       * En este PUT, los opcionales omitidos se reemplazan por null.
       */
      const proyectoActualizado =
        await this.proyectosRepository.actualizar(
          client,
          idProyecto,
          idUsuarioAutenticado,
          {
            nombre: datos.nombre,
            descripcion: datos.descripcion,
            direccion: datos.direccion,
            contratante: datos.contratante,
            fechaInicio: datos.fecha_inicio,
            fechaFinalizacion: datos.fecha_finalizacion ?? null,
            estadoProyecto: datos.estado_proyecto,
            latitud: datos.latitud ?? null,
            longitud: datos.longitud ?? null,
          },
        );

      await this.actividadesRepository.crear(client, {
        idProyecto: proyectoActualizado.id_proyecto,
        idActor: idUsuarioAutenticado,
        tipoAccion: 'PROYECTO_MODIFICADO',
        mensaje: 'Datos del proyecto actualizados.',
      });

      return toProyectoResponse(proyectoActualizado);
    });
  }

  /**
   * Elimina lógicamente un proyecto por solicitud de su propietario.
   *
   * Conserva fotografías, planos, panorámicas, incidencias,
   * actividades y colaboradores.
   *
   * El cambio y su actividad se confirman juntos.
   */
  async eliminarLogicamente(
    idProyecto: string,
    idUsuarioAutenticado: string,
  ): Promise<void> {
    await this.database.withTransaction(async (client) => {
      const propietarioActivo =
        await this.proyectosRepository.bloquearPropietarioActivo(
          client,
          idUsuarioAutenticado,
        );

      if (!propietarioActivo) {
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

      if (proyecto === null) {
        throw new NotFoundException(
          'El proyecto no está disponible para eliminación.',
        );
      }

      await this.proyectosRepository.eliminarLogicamente(
        client,
        idProyecto,
        idUsuarioAutenticado,
      );

      /**
       * El proyecto sigue existiendo, por lo que la actividad
       * conserva una referencia válida mediante su clave foránea.
       */
      await this.actividadesRepository.crear(client, {
        idProyecto,
        idActor: idUsuarioAutenticado,
        tipoAccion: 'PROYECTO_ELIMINADO_LOGICAMENTE',
        mensaje: 'Proyecto eliminado lógicamente.',
      });
    });
  }


  /**
   * Agrega un usuario existente como colaborador del proyecto.
   *
   * Precondiciones:
   * - Los identificadores fueron validados como UUID.
   * - idUsuarioAutenticado procede de AuthGuard.
   *
   * Comprueba la propiedad antes de consultar al destinatario.
   * Esto evita revelar cuentas mediante una operación sobre
   * un proyecto que el solicitante no puede administrar.
   *
   * La relación y la actividad se confirman juntas.
   */
  async agregarColaborador(
    idProyecto: string,
    idUsuarioAutenticado: string,
    idColaborador: string,
  ): Promise<void> {
    await this.database.withTransaction(async (client) => {
      const propietarioActivo =
        await this.proyectosRepository.bloquearPropietarioActivo(
          client,
          idUsuarioAutenticado,
        );

      if (!propietarioActivo) {
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

      if (proyecto === null) {
        throw new NotFoundException(
          'El proyecto no está disponible para gestionar colaboradores.',
        );
      }

      const usuarioExiste =
        await this.proyectosRepository.bloquearUsuarioExistente(
          client,
          idColaborador,
        );

      if (!usuarioExiste) {
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

      /**
       * Una relación existente no representa una incorporación nueva.
       * No generamos otra actividad por repetir la solicitud.
       */
      if (!agregado) {
        return;
      }

      await this.actividadesRepository.crear(client, {
        idProyecto,
        idActor: idUsuarioAutenticado,
        tipoAccion: 'COLABORADOR_AGREGADO',
        mensaje: `Usuario ${idColaborador} agregado como colaborador.`,
      });
    });
  }

}