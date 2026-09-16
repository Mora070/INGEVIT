import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  IncidenciasConsultaRepository,
} from './incidencias-consulta.repository';

import { mapearIncidencia } from './mappers/incidencia.mapper';
import type {
  ListarIncidenciasQueryDto,
} from './dto/listar-incidencias-query.dto';

@Injectable()
export class IncidenciasConsultaService {
  constructor(
    private readonly repositorio: IncidenciasConsultaRepository,
  ) {}

  /**
   * La consulta debe haber pasado por la validación del DTO.
   * Solo informa del rango de páginas después de comprobar el acceso.
   */
  async listar(
    idProyecto: string,
    idPlano: string,
    idUsuario: string,
    consulta: ListarIncidenciasQueryDto,
  ) {
    const resultado = await this.repositorio.listarDisponibles(
      idProyecto,
      idPlano,
      idUsuario,
      consulta.numero_pagina,
      consulta.pagina,
      consulta.limite,
    );

    if (resultado === null) {
      throw new NotFoundException('El plano no está disponible.');
    }

    if (consulta.numero_pagina > resultado.numeroPaginas) {
      throw new BadRequestException(
        'La página indicada no existe en el plano.',
      );
    }

    return {
      incidencias: resultado.incidencias.map(mapearIncidencia),
      numero_pagina: consulta.numero_pagina,
      pagina: consulta.pagina,
      limite: consulta.limite,
      total: resultado.total,
      total_paginas: Math.ceil(resultado.total / consulta.limite),
    };
  }
}