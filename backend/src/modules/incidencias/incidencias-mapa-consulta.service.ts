import { Injectable, NotFoundException } from '@nestjs/common';

import {
  IncidenciasMapaConsultaRepository,
} from './incidencias-mapa-consulta.repository';
import {
  mapearIncidenciaMapa,
} from './mappers/incidencia-mapa.mapper';
import type {
  ListarIncidenciasMapaQueryDto,
} from './dto/listar-incidencias-mapa-query.dto';

/**
 * Construye el listado público.
 * El repositorio comprueba el acceso junto con la consulta.
 */
@Injectable()
export class IncidenciasMapaConsultaService {
  constructor(
    private readonly repositorio: IncidenciasMapaConsultaRepository,
  ) {}

  /** Los parámetros deben haber pasado por la validación del DTO. */
  async listar(
    idProyecto: string,
    idUsuario: string,
    consulta: ListarIncidenciasMapaQueryDto,
  ) {
    const resultado = await this.repositorio.listarDisponibles(
      idProyecto,
      idUsuario,
      consulta.pagina,
      consulta.limite,
    );

    if (resultado === null) {
      throw new NotFoundException('El proyecto no está disponible.');
    }

    return {
      incidencias: resultado.incidencias.map(mapearIncidenciaMapa),
      pagina: consulta.pagina,
      limite: consulta.limite,
      total: resultado.total,
      total_paginas: Math.ceil(resultado.total / consulta.limite),
    };
  }
}