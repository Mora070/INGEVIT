import { Module } from '@nestjs/common';

import {
  DatabaseModule,
} from '../../database/database.module';

import {
  AuthModule,
} from '../auth/auth.module';

import {
  UsuariosModule,
} from '../usuarios/usuarios.module';

import {
  ActividadesModule,
} from '../actividades/actividades.module';

import {
  FotografiasModule,
} from '../fotografias/fotografias.module';

import {
  NotificacionesRepository,
} from '../notificaciones/notificaciones.repository';

import {
  ProyectosController,
} from './proyectos.controller';

import {
  ProyectosRepository,
} from './proyectos.repository';

import {
  ProyectosService,
} from './proyectos.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsuariosModule,
    ActividadesModule,
    FotografiasModule,
  ],

  controllers: [
    ProyectosController,
  ],

  providers: [
    ProyectosRepository,
    ProyectosService,
    NotificacionesRepository,
  ],
})
export class ProyectosModule {}