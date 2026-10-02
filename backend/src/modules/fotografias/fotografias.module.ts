import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';

import {
  ActividadesModule,
} from '../actividades/actividades.module';

import {
  AlmacenamientoModule,
} from '../almacenamiento/almacenamiento.module';

import {
  AuthModule,
} from '../auth/auth.module';

import {
  UsuariosModule,
} from '../usuarios/usuarios.module';

import {
  NotificacionesRepository,
} from '../notificaciones/notificaciones.repository';

import {
  FotografiasAccesoRepository,
} from './fotografias-acceso.repository';

import {
  FotografiasArchivosService,
} from './fotografias-archivos.service';

import {
  FotografiasConsultaRepository,
} from './fotografias-consulta.repository';

import {
  FotografiasPersistenciaService,
} from './fotografias-persistencia.service';

import {
  FotografiasSubidaService,
} from './fotografias-subida.service';

import {
  FotografiasRepository,
} from './fotografias.repository';

import {
  FotografiasService,
} from './fotografias.service';

import {
  FotografiasDescargaRepository,
} from './fotografias-descarga.repository';

import {
  FotografiasDescargaService,
} from './fotografias-descarga.service';

import {
  FotografiasDescargaController,
} from './fotografias-descarga.controller';

import {
  FotografiasEdicionService,
} from './fotografias-edicion.service';

import {
  FotografiasEdicionController,
} from './fotografias-edicion.controller';

import {
  FotografiasEliminacionService,
} from './fotografias-eliminacion.service';

import {
  FotografiasEliminacionController,
} from './fotografias-eliminacion.controller';

@Module({
  imports: [
    DatabaseModule,
    AlmacenamientoModule,
    ActividadesModule,
    AuthModule,
    UsuariosModule,
  ],

  controllers: [
    FotografiasDescargaController,
    FotografiasEdicionController,
    FotografiasEliminacionController,
  ],

  providers: [
    FotografiasConsultaRepository,
    FotografiasService,

    FotografiasAccesoRepository,
    FotografiasRepository,

    FotografiasArchivosService,
    FotografiasPersistenciaService,

    FotografiasSubidaService,

    FotografiasDescargaRepository,
    FotografiasDescargaService,

    FotografiasEdicionService,

    FotografiasEliminacionService,

    NotificacionesRepository,
  ],

  exports: [
    FotografiasService,
    FotografiasSubidaService,
    FotografiasDescargaService,
    FotografiasEdicionService,
  ],
})
export class FotografiasModule {}