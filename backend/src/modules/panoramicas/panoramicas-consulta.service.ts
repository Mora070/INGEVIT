import { Injectable, NotFoundException } from '@nestjs/common';

import {
  PanoramicasConsultaRepository,
} from './panoramicas-consulta.repository';
import { mapearPanoramica } from './mappers/panoramica.mapper';
import type {
  ListarPanoramicasQueryDto,
} from './dto/listar-panoramicas-query.dto';

/** Devuelve exclusivamente los metadatos públicos del listado. */
@Injectable()
export class PanoramicasConsultaService {
  constructor(
    private readonly repositorio: PanoramicasConsultaRepository,
  ) {}

  async listar(
    idProyecto: string,
    idUsuario: string,
    consulta: ListarPanoramicasQueryDto,
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
      panoramicas: resultado.panoramicas.map(mapearPanoramica),
      pagina: consulta.pagina,
      limite: consulta.limite,
      total: resultado.total,
      total_paginas: Math.ceil(resultado.total / consulta.limite),
    };
  }
}