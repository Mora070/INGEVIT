import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { ActividadesModule } from '../actividades/actividades.module';
import { AlmacenamientoModule } from '../almacenamiento/almacenamiento.module';

import { FotografiasAccesoRepository } from './fotografias-acceso.repository';
import { FotografiasArchivosService } from './fotografias-archivos.service';
import { FotografiasConsultaRepository } from './fotografias-consulta.repository';
import { FotografiasPersistenciaService } from './fotografias-persistencia.service';
import { FotografiasSubidaService } from './fotografias-subida.service';
import { FotografiasRepository } from './fotografias.repository';
import { FotografiasService } from './fotografias.service';

/**
 * Agrupa la consulta y la subida de fotografías de los proyectos.
 *
 * Dependencias:
 * - DatabaseModule: consultas y transacciones de PostgreSQL.
 * - AlmacenamientoModule: lectura y escritura de archivos.
 * - ActividadesModule: registro de la actividad de subida.
 *
 * Los repositorios y los servicios internos permanecen encapsulados.
 * Otros módulos acceden mediante los servicios exportados.
 */
@Module({
  imports: [
    DatabaseModule,
    AlmacenamientoModule,
    ActividadesModule,
  ],
  providers: [
    // Consulta de fotografías disponibles para el usuario.
    FotografiasConsultaRepository,
    FotografiasService,

    // Autorización y escritura de registros.
    FotografiasAccesoRepository,
    FotografiasRepository,

    // Guardado de versiones y coordinación con PostgreSQL.
    FotografiasArchivosService,
    FotografiasPersistenciaService,

    // Operación completa de subida.
    FotografiasSubidaService,
  ],
  exports: [
    FotografiasService,
    FotografiasSubidaService,
  ],
})
export class FotografiasModule {}