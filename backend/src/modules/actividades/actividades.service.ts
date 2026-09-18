import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  ActividadesConsultaRepository,
} from './actividades-consulta.repository';

import {
  mapearActividad,
} from './mappers/actividad.mapper';

import type {
  ListarActividadesQueryDto,
} from './dto/listar-actividades-query.dto';

import type {
  ActividadesPaginadasResponse,
} from './types/actividades-paginadas.types';

/**
 * Coordina la lectura del historial de actividades.
 *
 * La consulta del repositorio comprueba el acceso al proyecto
 * y obtiene la página junto con su total en una sola sentencia.
 */
@Injectable()
export class ActividadesService {
  constructor(
    private readonly actividadesConsultaRepository:
      ActividadesConsultaRepository,
  ) {}

  /**
   * Devuelve una página del historial disponible para el solicitante.
   *
   * La identidad debe proceder de la sesión autenticada.
   * Los parámetros de paginación deben haber sido validados por el DTO.
   *
   * Un historial vacío es una respuesta válida.
   * Un proyecto no disponible produce el mismo 404 tanto si no existe
   * como si el solicitante no tiene acceso.
   */
  async listarDisponibles(
    idProyecto: string,
    idUsuario: string,
    consulta: ListarActividadesQueryDto,
  ): Promise<ActividadesPaginadasResponse> {
    const resultado =
      await this.actividadesConsultaRepository.findDisponiblesPaginadas(
        idProyecto,
        idUsuario,
        consulta.pagina,
        consulta.limite,
      );

    if (resultado === null) {
      throw new NotFoundException(
        'El proyecto no está disponible.',
      );
    }

    return {
      actividades: resultado.actividades.map(mapearActividad),
      pagina: consulta.pagina,
      limite: consulta.limite,
      total: resultado.total,
      total_paginas: Math.ceil(
        resultado.total / consulta.limite,
      ),
    };
  }
}