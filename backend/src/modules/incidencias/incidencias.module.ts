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

import {
    IncidenciasMapaCreacionService,
} from './incidencias-mapa-creacion.service';

import {
    IncidenciasMapaCreacionController,
} from './incidencias-mapa-creacion.controller';

import {
    IncidenciasMapaConsultaRepository,
} from './incidencias-mapa-consulta.repository';

import {
    IncidenciasMapaConsultaService,
} from './incidencias-mapa-consulta.service';

import {
    IncidenciasMapaConsultaController,
} from './incidencias-mapa-consulta.controller';

import {
  IncidenciasMapaEdicionService,
} from './incidencias-mapa-edicion.service';

import {
  IncidenciasMapaEdicionController,
} from './incidencias-mapa-edicion.controller';

import {
  IncidenciasMapaEliminacionService,
} from './incidencias-mapa-eliminacion.service';

import {
  IncidenciasMapaEliminacionController,
} from './incidencias-mapa-eliminacion.controller';

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
    controllers: [IncidenciasCreacionController, IncidenciasConsultaController, IncidenciasEdicionController, IncidenciasEliminacionController, IncidenciasMapaCreacionController,IncidenciasMapaConsultaController,IncidenciasMapaEdicionController,IncidenciasMapaEliminacionController],
    providers: [
        ProyectoAccesoRepository,
        IncidenciasPlanoRepository,
        IncidenciasRepository,
        IncidenciasCreacionService,
        IncidenciasConsultaRepository,
        IncidenciasConsultaService,
        IncidenciasEdicionService,
        IncidenciasEliminacionService,
        IncidenciasMapaCreacionService,
        IncidenciasMapaConsultaRepository,
        IncidenciasMapaConsultaService,
        IncidenciasMapaEdicionService,
        IncidenciasMapaEliminacionService
    ],
})
export class IncidenciasModule { }