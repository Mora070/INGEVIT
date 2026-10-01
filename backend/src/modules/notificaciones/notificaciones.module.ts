import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { CorreosModule } from '../correos/correos.module';

import {
  NotificacionesConsultaController,
} from './notificaciones-consulta.controller';

import {
  NotificacionesLecturaController,
} from './notificaciones-lectura.controller';

import {
  NotificacionesEventosController,
} from './notificaciones-eventos.controller';

import {
  NotificacionesConsultaService,
} from './notificaciones-consulta.service';

import {
  NotificacionesLecturaService,
} from './notificaciones-lectura.service';

import {
  NotificacionesEventosService,
} from './notificaciones-eventos.service';

import {
  NotificacionesPostgresListenerService,
} from './notificaciones-postgres-listener.service';

import {
  NotificacionesConsultaRepository,
} from './notificaciones-consulta.repository';

import {
  NotificacionesLecturaRepository,
} from './notificaciones-lectura.repository';

import {
  NotificacionesCorreoRepository,
} from './correos/notificaciones-correo.repository';

import {
  NotificacionesCorreoService,
} from './correos/notificaciones-correo.service';

import {
  NotificacionesCorreoWorker,
} from './correos/notificaciones-correo.worker';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsuariosModule,
    CorreosModule,
  ],

  controllers: [
    NotificacionesConsultaController,
    NotificacionesLecturaController,
    NotificacionesEventosController,
  ],

  providers: [
    NotificacionesConsultaRepository,
    NotificacionesConsultaService,

    NotificacionesLecturaRepository,
    NotificacionesLecturaService,

    NotificacionesEventosService,
    NotificacionesPostgresListenerService,

    NotificacionesCorreoRepository,
    NotificacionesCorreoService,
    NotificacionesCorreoWorker,
  ],
})
export class NotificacionesModule {}