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

@Injectable()
export class NotificacionesPostgresListenerService
  implements OnModuleInit, OnApplicationShutdown {
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
  ) {}

  async onModuleInit(): Promise<void> {
    await this.client.connect();

    await this.client.query(
      'LISTEN notificaciones_nuevas',
    );

    this.client.on(
      'notification',
      (mensaje) => {
        if (
          mensaje.channel !==
          'notificaciones_nuevas'
        ) {
          return;
        }

        if (!mensaje.payload) {
          return;
        }

        try {
          const datos =
            JSON.parse(
              mensaje.payload,
            ) as {
              id_receptor?: string;
            };

          if (!datos.id_receptor) {
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
      },
    );

    this.logger.log(
      'Escuchando notificaciones PostgreSQL.',
    );
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.query(
        'UNLISTEN notificaciones_nuevas',
      );
    } finally {
      await this.client.end();
    }
  }
}