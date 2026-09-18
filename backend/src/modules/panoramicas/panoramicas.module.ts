import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import {
  ProyectoAccesoRepository,
} from '../../common/repositories/proyecto-acceso.repository';

import { AuthModule } from '../auth/auth.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { ActividadesModule } from '../actividades/actividades.module';
import {
  AlmacenamientoModule,
} from '../almacenamiento/almacenamiento.module';

import { PanoramicasRepository } from './panoramicas.repository';
import {
  PanoramicasPersistenciaService,
} from './panoramicas-persistencia.service';
import { PanoramicasSubidaService } from './panoramicas-subida.service';
import {
  PanoramicasSubidaController,
} from './panoramicas-subida.controller';

import {
  PanoramicasDescargaRepository,
} from './panoramicas-descarga.repository';

import {
  PanoramicasDescargaService,
} from './panoramicas-descarga.service';

import {
  PanoramicasDescargaController,
} from './panoramicas-descarga.controller';

import {
  PanoramicasConsultaRepository,
} from './panoramicas-consulta.repository';

import {
  PanoramicasConsultaService,
} from './panoramicas-consulta.service';

import {
  PanoramicasConsultaController,
} from './panoramicas-consulta.controller';

import {
  PanoramicasEdicionService,
} from './panoramicas-edicion.service';

import {
  PanoramicasEdicionController,
} from './panoramicas-edicion.controller';

import {
  PanoramicasEliminacionService,
} from './panoramicas-eliminacion.service';

import {
  PanoramicasEliminacionController,
} from './panoramicas-eliminacion.controller';

/** Agrupa la recepción y persistencia de imágenes panorámicas. */
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsuariosModule,
    ActividadesModule,
    AlmacenamientoModule,
  ],
  controllers: [PanoramicasSubidaController,PanoramicasDescargaController,PanoramicasConsultaController,
    PanoramicasEdicionController,PanoramicasEliminacionController ],
  providers: [
    ProyectoAccesoRepository,
    PanoramicasRepository,
    PanoramicasPersistenciaService,
    PanoramicasSubidaService,
    PanoramicasDescargaRepository,
    PanoramicasDescargaService,
    PanoramicasConsultaRepository,
    PanoramicasConsultaService,
    PanoramicasEdicionService,
    PanoramicasEliminacionService
  ],
})
export class PanoramicasModule {}