import { Injectable, NotFoundException } from '@nestjs/common';

import { CapasConsultaRepository } from './capas-consulta.repository';
import { mapearCapa } from './mappers/capa.mapper';
import type { ListarCapasQueryDto } from './dto/listar-capas-query.dto';

/** Convierte los registros autorizados en una respuesta pública paginada. */
@Injectable()
export class CapasConsultaService {
  constructor(
    private readonly repositorio: CapasConsultaRepository,
  ) {}

  async listar(
    idProyecto: string,
    idUsuario: string,
    consulta: ListarCapasQueryDto,
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
      capas: resultado.capas.map(mapearCapa),
      pagina: consulta.pagina,
      limite: consulta.limite,
      total: resultado.total,
      total_paginas: Math.ceil(resultado.total / consulta.limite),
    };
  }
}