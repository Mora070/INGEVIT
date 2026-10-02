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
    private readonly repository:
      NotificacionesLecturaRepository,
  ) {}

  async contarNoLeidas(
    idUsuario: string,
  ): Promise<number> {
    return this.repository.contarNoLeidas(
      idUsuario,
    );
  }

  async marcarLeida(
    idUsuario: string,
    idNotificacion: string,
  ): Promise<void> {
    const actualizada =
      await this.repository.marcarLeida(
        idUsuario,
        idNotificacion,
      );

    if (
      !actualizada
    ) {
      return;
    }
  }

  async marcarTodasLeidas(
    idUsuario: string,
  ): Promise<number> {
    return this.repository.marcarTodasLeidas(
      idUsuario,
    );
  }

  async eliminar(
    idUsuario: string,
    idNotificacion: string,
  ): Promise<void> {
    const eliminada =
      await this.repository.eliminar(
        idUsuario,
        idNotificacion,
      );

    if (
      !eliminada
    ) {
      throw new NotFoundException(
        'La notificación no existe o ya fue eliminada.',
      );
    }
  }
}