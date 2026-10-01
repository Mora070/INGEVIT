import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  NotificacionesLecturaRepository,
} from './notificaciones-lectura.repository';

@Injectable()
export class NotificacionesLecturaService {
  constructor(
    private readonly repositorio:
      NotificacionesLecturaRepository,
  ) {}

  async contarNoLeidas(
    idUsuario: string,
  ) {
    const total =
      await this.repositorio.contarNoLeidas(
        idUsuario,
      );

    return {
      total,
    };
  }

  async marcarLeida(
    idUsuario: string,
    idNotificacion: string,
  ) {
    const actualizada =
      await this.repositorio.marcarLeida(
        idUsuario,
        idNotificacion,
      );

    if (!actualizada) {
      throw new NotFoundException(
        'La notificación no existe o ya fue marcada como leída.',
      );
    }

    return {
      ok: true,
    };
  }

  async marcarTodasLeidas(
    idUsuario: string,
  ) {
    const actualizadas =
      await this.repositorio.marcarTodasLeidas(
        idUsuario,
      );

    return {
      actualizadas,
    };
  }
}