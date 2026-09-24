import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { UsuariosModule } from '../usuarios/usuarios.module';

import { CapasConsultaRepository } from './capas-consulta.repository';
import { CapasConsultaService } from './capas-consulta.service';
import { CapasConsultaController } from './capas-consulta.controller';

import { ActividadesModule } from '../actividades/actividades.module';
import { ProyectosRepository } from '../proyectos/proyectos.repository';

import { CapasRepository } from './capas.repository';
import { CapasConfiguracionService } from './capas-configuracion.service';
import { CapasConfiguracionController } from './capas-configuracion.controller';

import { PropietarioCapaGuard } from './guards/propietario-capa.guard';

import { AlmacenamientoModule } from '../almacenamiento/almacenamiento.module';
import { CapasPersistenciaService } from './capas-persistencia.service';

import { GeoTiffInspectorService } from './geotiff-inspector.service';
import { CapasSubidaService } from './capas-subida.service';
import { CapasSubidaController } from './capas-subida.controller';

import { CapasProcesamientoRepository } from './capas-procesamiento.repository';

import {
  CapasProcesamientoArchivosService,
} from './capas-procesamiento-archivos.service';
import {
  CapasProcesamientoService,
} from './capas-procesamiento.service';

import { CapasColaService } from './capas-cola.service';
import { CapasProcesamientoWorker } from './capas-procesamiento.worker';

import { CapasTeselasRepository } from './capas-teselas.repository';
import { TeselasLocalesService } from './teselas-locales.service';
import { CapasTeselasService } from './capas-teselas.service';
import { CapasTeselasController } from './capas-teselas.controller';

import { CapasTilejsonService } from './capas-tilejson.service';
import { CapasTilejsonController } from './capas-tilejson.controller';

import { CapasReintentoRepository } from './capas-reintento.repository';
import { CapasReintentoService } from './capas-reintento.service';
import { CapasReintentoController } from './capas-reintento.controller';
import { CapasRecuperacionService } from './capas-recuperacion.service';

import { CapasEliminacionRepository } from './capas-eliminacion.repository';
import { CapasEliminacionService } from './capas-eliminacion.service';
import { CapasLimpiezaService } from './capas-limpieza.service';
import { CapasEliminacionController } from './capas-eliminacion.controller';

/** Agrupa las operaciones de capas raster del proyecto. */
@Module({
  imports: [DatabaseModule, AuthModule, UsuariosModule,ActividadesModule,AlmacenamientoModule],
  controllers: [CapasConsultaController,CapasConfiguracionController,CapasSubidaController,
    CapasTeselasController,CapasTilejsonController,CapasReintentoController,CapasEliminacionController,],
  providers: [
    CapasConsultaRepository,
    CapasConsultaService,
    ProyectosRepository,
    CapasRepository,
    CapasConfiguracionService,
    PropietarioCapaGuard,
    CapasPersistenciaService,
    GeoTiffInspectorService,
    CapasSubidaService,
    CapasProcesamientoRepository,
    CapasProcesamientoArchivosService,
    CapasProcesamientoService,
    CapasColaService,
    CapasProcesamientoWorker,
    CapasTeselasRepository,
    TeselasLocalesService,
    CapasTeselasService,
    CapasTilejsonService,
    CapasReintentoRepository,
    CapasReintentoService,
    CapasRecuperacionService,
    CapasEliminacionRepository,
    CapasEliminacionService,
    CapasLimpiezaService,
  ],
})
export class CapasModule {}