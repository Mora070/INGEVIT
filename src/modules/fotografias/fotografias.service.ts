import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  FotografiasConsultaRepository,
} from './fotografias-consulta.repository';

import {
  mapearFotografia,
} from './mappers/fotografia.mapper';

import type {
  ListarFotografiasQueryDto,
} from './dto/listar-fotografias-query.dto';

import type {
  FotografiasPaginadasResponse,
} from './types/fotografias-paginadas.types';

/**
 * Coordina la consulta de fotografías del proyecto.
 *
 * El repositorio comprueba el acceso y obtiene la página junto
 * con su total en una sola sentencia SQL.
 *
 * Este servicio consulta metadatos; no descarga ni modifica archivos.
 */
@Injectable()
export class FotografiasService {
  constructor(
    private readonly fotografiasConsultaRepository:
      FotografiasConsultaRepository,
  ) {}

  /**
   * Devuelve una página de fotografías disponible para el solicitante.
   *
   * La identidad debe proceder de la sesión autenticada.
   * Los parámetros de paginación deben haber sido validados por el DTO.
   *
   * Un proyecto sin fotografías devuelve una página vacía.
   * Un proyecto no disponible produce 404.
   */
  async listarDisponibles(
    idProyecto: string,
    idUsuario: string,
    consulta: ListarFotografiasQueryDto,
  ): Promise<FotografiasPaginadasResponse> {
    const resultado =
      await this.fotografiasConsultaRepository.findDisponiblesPaginadas(
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
      fotografias: resultado.fotografias.map(mapearFotografia),
      pagina: consulta.pagina,
      limite: consulta.limite,
      total: resultado.total,
      total_paginas: Math.ceil(
        resultado.total / consulta.limite,
      ),
    };
  }
}