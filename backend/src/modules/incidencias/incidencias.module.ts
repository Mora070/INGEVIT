import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import {
    ProyectoAccesoRepository,
} from '../../common/repositories/proyecto-acceso.repository';

import { AuthModule } from '../auth/auth.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { ActividadesModule } from '../actividades/actividades.module';

import {
    IncidenciasCreacionController,
} from './incidencias-creacion.controller';
import {
    IncidenciasCreacionService,
} from './incidencias-creacion.service';
import {
    IncidenciasPlanoRepository,
} from './incidencias-plano.repository';
import { IncidenciasRepository } from './incidencias.repository';

import {
    IncidenciasConsultaController,
} from './incidencias-consulta.controller';

import {
    IncidenciasConsultaService,
} from './incidencias-consulta.service';

import {
    IncidenciasConsultaRepository,
} from './incidencias-consulta.repository';

import {
  IncidenciasEdicionService,
} from './incidencias-edicion.service';

import {
  IncidenciasEdicionController,
} from './incidencias-edicion.controller';

import {
  IncidenciasEliminacionService,
} from './incidencias-eliminacion.service';

import {
  IncidenciasEliminacionController,
} from './incidencias-eliminacion.controller';

/**
 * Agrupa las operaciones sobre incidencias.
 * Comparte la conexión a PostgreSQL y el registro de actividades.
 */
@Module({
    imports: [
        DatabaseModule,
        AuthModule,
        UsuariosModule,
        ActividadesModule,
    ],
    controllers: [IncidenciasCreacionController, IncidenciasConsultaController,IncidenciasEdicionController,IncidenciasEliminacionController],
    providers: [
        ProyectoAccesoRepository,
        IncidenciasPlanoRepository,
        IncidenciasRepository,
        IncidenciasCreacionService,
        IncidenciasConsultaRepository,
        IncidenciasConsultaService,
        IncidenciasEdicionService,
        IncidenciasEliminacionService
    ],
})
export class IncidenciasModule { }