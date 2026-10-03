import {
  Module,
} from '@nestjs/common';

import {
  DatabaseModule,
} from '../../database/database.module';

import {
  AuthModule,
} from '../auth/auth.module';

import {
  CarpetasAccesoRepository,
} from './carpetas-acceso.repository';

import {
  CarpetasRepository,
} from './carpetas.repository';

import {
  CarpetasRecursosRepository,
} from './carpetas-recursos.repository';

import {
  CarpetasCreacionService,
} from './carpetas-creacion.service';

import {
  CarpetasActualizacionService,
} from './carpetas-actualizacion.service';

import {
  CarpetasMovimientoService,
} from './carpetas-movimiento.service';

import {
  CarpetasEliminacionService,
} from './carpetas-eliminacion.service';

import {
  CarpetasRecursosService,
} from './carpetas-recursos.service';

import {
  CarpetasConsultaService,
} from './carpetas-consulta.service';

import {
  CarpetasCreacionController,
} from './carpetas-creacion.controller';

import {
  CarpetasConsultaController,
} from './carpetas-consulta.controller';

import {
  CarpetasEdicionController,
} from './carpetas-edicion.controller';

import {
  CarpetasEliminacionController,
} from './carpetas-eliminacion.controller';

import {
  CarpetasRecursosController,
} from './carpetas-recursos.controller';

import {
  ActividadesModule,
} from '../actividades/actividades.module';

import { UsuariosModule } from '../usuarios/usuarios.module';



@Module({
imports: [
  DatabaseModule,
  AuthModule,
  ActividadesModule,
  UsuariosModule
],

  controllers: [
    CarpetasCreacionController,
    CarpetasConsultaController,
    CarpetasEdicionController,
    CarpetasEliminacionController,
    CarpetasRecursosController,
  ],

  providers: [
    CarpetasAccesoRepository,
    CarpetasRepository,
    CarpetasRecursosRepository,

    CarpetasCreacionService,
    CarpetasActualizacionService,
    CarpetasMovimientoService,
    CarpetasEliminacionService,
    CarpetasRecursosService,
    CarpetasConsultaService,
  ],

  exports: [
    CarpetasConsultaService,
    CarpetasRecursosService,
  ],
})
export class CarpetasModule {}