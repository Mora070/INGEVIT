import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { CorreosModule } from '../correos/correos.module';

import {
  NotificacionesConsultaController,
} from './notificaciones-consulta.controller';
import {
  NotificacionesConsultaService,
} from './notificaciones-consulta.service';
import {
  NotificacionesConsultaRepository,
} from './notificaciones-consulta.repository';
import {
  NotificacionesCorreoRepository,
} from './correos/notificaciones-correo.repository';
import {
  NotificacionesCorreoService,
} from './correos/notificaciones-correo.service';

import {
  NotificacionesCorreoWorker,
} from './correos/notificaciones-correo.worker';

/**
 * Expone el historial y coordina el procesamiento de correo.
 *
 * El trigger de PostgreSQL crea las notificaciones de incidencias.
 * El trabajador solo programa envíos cuando su configuración
 * lo habilita explícitamente.
 */
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsuariosModule,
    CorreosModule,
  ],
  controllers: [NotificacionesConsultaController],
  providers: [
    NotificacionesConsultaRepository,
    NotificacionesConsultaService,
    NotificacionesCorreoRepository,
    NotificacionesCorreoService,
    NotificacionesCorreoWorker,
  ],
})
export class NotificacionesModule {}