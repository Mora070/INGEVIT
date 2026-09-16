import { Injectable } from '@nestjs/common';

import {
  NotificacionesConsultaRepository,
} from './notificaciones-consulta.repository';
import { mapearNotificacion } from './mappers/notificacion.mapper';

import type {
  ListarNotificacionesQueryDto,
} from './dto/listar-notificaciones-query.dto';

/** Devuelve el historial disponible, sin información interna del correo. */
@Injectable()
export class NotificacionesConsultaService {
  constructor(
    private readonly repositorio: NotificacionesConsultaRepository,
  ) {}

  async listar(
    idUsuario: string,
    consulta: ListarNotificacionesQueryDto,
  ) {
    const resultado = await this.repositorio.listarDisponibles(
      idUsuario,
      consulta.pagina,
      consulta.limite,
    );

    return {
      notificaciones: resultado.notificaciones.map(mapearNotificacion),
      pagina: consulta.pagina,
      limite: consulta.limite,
      total: resultado.total,
      total_paginas: Math.ceil(resultado.total / consulta.limite),
    };
  }
}