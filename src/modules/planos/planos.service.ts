import { Injectable, NotFoundException } from '@nestjs/common';

import { PlanosConsultaRepository } from './planos-consulta.repository';
import { mapearPlano } from './mappers/plano.mapper';

import type {
  ListarPlanosQueryDto,
} from './dto/listar-planos-query.dto';

import type {
  PlanosPaginadosResponse,
} from './types/planos-paginados.types';

/**
 * Coordina el listado y devuelve únicamente metadatos públicos.
 */
@Injectable()
export class PlanosService {
  constructor(
    private readonly consulta: PlanosConsultaRepository,
  ) {}

  async listarDisponibles(
    idProyecto: string,
    idUsuario: string,
    parametros: ListarPlanosQueryDto,
  ): Promise<PlanosPaginadosResponse> {
    const resultado = await this.consulta.findDisponiblesPaginadas(
      idProyecto,
      idUsuario,
      parametros.pagina,
      parametros.limite,
    );

    if (resultado === null) {
      throw new NotFoundException(
        'El proyecto no está disponible.',
      );
    }

    return {
      planos: resultado.planos.map(mapearPlano),
      pagina: parametros.pagina,
      limite: parametros.limite,
      total: resultado.total,
      total_paginas: Math.ceil(resultado.total / parametros.limite),
    };
  }
}