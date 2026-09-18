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

import { PlanosController } from './planos.controller';
import { PlanosConsultaRepository } from './planos-consulta.repository';
import { PlanosRepository } from './planos.repository';
import { PlanosService } from './planos.service';
import { PlanosSubidaService } from './planos-subida.service';
import {
  PlanosPersistenciaService,
} from './planos-persistencia.service';

import {
  PlanosSubidaController,
} from './planos-subida.controller';

import {
  PlanosDescargaRepository,
} from './planos-descarga.repository';

import {
  PlanosDescargaService,
} from './planos-descarga.service';

import {
  PlanosDescargaController,
} from './planos-descarga.controller';

import {
  PlanosEdicionService,
} from './planos-edicion.service';

import {
  PlanosEdicionController,
} from './planos-edicion.controller';

import {
  PlanosEliminacionService,
} from './planos-eliminacion.service';

import {
  PlanosEliminacionController,
} from './planos-eliminacion.controller';

/**
 * Agrupa la consulta y subida de planos.
 * Comparte el almacenamiento y la escritura de actividades.
 */
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsuariosModule,
    ActividadesModule,
    AlmacenamientoModule,
  ],
  controllers: [PlanosController, PlanosSubidaController, PlanosDescargaController,PlanosEdicionController,PlanosEliminacionController],
  providers: [
    ProyectoAccesoRepository,
    PlanosConsultaRepository,
    PlanosRepository,
    PlanosService,
    PlanosSubidaService,
    PlanosPersistenciaService,
    PlanosDescargaRepository,
    PlanosDescargaService,
    PlanosEdicionService,
    PlanosEliminacionService
  ],
})
export class PlanosModule { }