import { Injectable, NotFoundException, } from '@nestjs/common';

import { ProyectosRepository } from './proyectos.repository';
import { toProyectoResponse } from './mappers/proyecto.mapper';
import type { ListarProyectosQueryDto } from './dto/listar-proyectos-query.dto';
import type { ProyectoResponse } from './types/proyecto.types';
import type { ProyectosPaginadosResponse } from './types/proyectos-paginados.types';

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

}