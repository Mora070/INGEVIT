import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';

import {
  Client,
} from 'pg';

import {
  getDatabaseConfig,
} from '../../database/database.config';

import {
  NotificacionesEventosService,
} from './notificaciones-eventos.service';

type PayloadNotificacion = {
  id_receptor?: string;
};

type PayloadProyecto = {
  id_usuario?: string;
  id_proyecto?: string;
  recurso?:
  | 'FOTOGRAFIAS'
  | 'PANORAMICAS'
  | 'PLANOS'
  | 'ORTOFOTOS'
  | 'INCIDENCIAS'
  | 'CARPETAS';
};

@Injectable()
export class NotificacionesPostgresListenerService
  implements
  OnModuleInit,
  OnApplicationShutdown {
  private readonly logger =
    new Logger(
      NotificacionesPostgresListenerService.name,
    );

  private readonly client =
    new Client(
      getDatabaseConfig(),
    );

  constructor(
    private readonly eventos:
      NotificacionesEventosService,
  ) { }

  async onModuleInit(): Promise<void> {
    await this.client.connect();

    await this.client.query(
      'LISTEN notificaciones_nuevas',
    );

    await this.client.query(
      'LISTEN proyecto_cambios',
    );

    this.client.on(
      'notification',
      (mensaje) => {
        if (
          !mensaje.payload
        ) {
          return;
        }

        if (
          mensaje.channel ===
          'notificaciones_nuevas'
        ) {
          this.procesarNotificacion(
            mensaje.payload,
          );

          return;
        }

        if (
          mensaje.channel ===
          'proyecto_cambios'
        ) {
          this.procesarCambioProyecto(
            mensaje.payload,
          );
        }
      },
    );

    this.logger.log(
      'Escuchando notificaciones y cambios de proyecto en PostgreSQL.',
    );
  }

  private procesarNotificacion(
    payload: string,
  ): void {
    try {
      const datos =
        JSON.parse(
          payload,
        ) as PayloadNotificacion;

      if (
        !datos.id_receptor
      ) {
        return;
      }

      this.eventos.emitir(
        datos.id_receptor,
      );
    } catch {
      this.logger.warn(
        'Se recibió una notificación PostgreSQL inválida.',
      );
    }
  }

  private procesarCambioProyecto(
    payload: string,
  ): void {
    try {
      const datos =
        JSON.parse(
          payload,
        ) as PayloadProyecto;

      if (
        !datos.id_usuario ||
        !datos.id_proyecto ||
        !datos.recurso
      ) {
        return;
      }

      if (
        datos.recurso !==
        'FOTOGRAFIAS' &&
        datos.recurso !==
        'PANORAMICAS' &&
        datos.recurso !==
        'PLANOS' &&
        datos.recurso !==
        'ORTOFOTOS' &&
        datos.recurso !==
        'INCIDENCIAS' &&
        datos.recurso !==
        'CARPETAS'
      ) {
        return;
      }

      this.eventos.emitirProyecto(
        datos.id_usuario,
        datos.id_proyecto,
        datos.recurso,
      );
    } catch {
      this.logger.warn(
        'Se recibió un evento de proyecto PostgreSQL inválido.',
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.query(
        'UNLISTEN notificaciones_nuevas',
      );

      await this.client.query(
        'UNLISTEN proyecto_cambios',
      );
    } finally {
      await this.client.end();
    }
  }
}