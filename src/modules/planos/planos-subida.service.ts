import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import {
  ProyectoAccesoRepository,
} from '../../common/repositories/proyecto-acceso.repository';
import {
  ActividadesRepository,
} from '../actividades/actividades.repository';

import { PlanosRepository } from './planos.repository';
import {
  PlanosPersistenciaService,
} from './planos-persistencia.service';
import { inspeccionarPlano } from './utils/inspeccionar-plano';
import { mapearPlano } from './mappers/plano.mapper';

import type { SubirPlanoDto } from './dto/subir-plano.dto';
import type { PlanoResponse } from './types/plano.types';

/**
 * Coordina la subida de un PDF original.
 *
 * La identidad procede de la sesión autenticada.
 * Los datos descriptivos deben haber pasado por la validación del DTO.
 *
 * Propietarios y colaboradores pueden subir planos.
 * El rol global de administrador no concede acceso adicional.
 */
@Injectable()
export class PlanosSubidaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly acceso: ProyectoAccesoRepository,
    private readonly persistencia: PlanosPersistenciaService,
    private readonly planos: PlanosRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  async subir(
    idProyecto: string,
    idUsuario: string,
    datos: SubirPlanoDto,
    contenido: Buffer,
  ): Promise<PlanoResponse> {
    // Rechazamos accesos no autorizados antes de interpretar el PDF.
    const disponible = await this.database.withTransaction(
      (client) =>
        this.acceso.bloquearDisponible(client, idProyecto, idUsuario),
    );

    if (!disponible) {
      throw new NotFoundException('El proyecto no está disponible.');
    }

    // La inspección no modifica los bytes que se almacenarán.
    await inspeccionarPlano(contenido);

    return this.persistencia.guardarYRegistrar(
      contenido,
      async (client, clave) => {
        /*
         * La pertenencia puede cambiar durante la inspección o escritura.
         * Esta segunda comprobación mantiene el acceso protegido hasta
         * confirmar el plano y su actividad.
         */
        const sigueDisponible = await this.acceso.bloquearDisponible(
          client,
          idProyecto,
          idUsuario,
        );

        if (!sigueDisponible) {
          throw new NotFoundException('El proyecto no está disponible.');
        }

        // La clave es generada por PlanosPersistenciaService.
        const nombreArchivo = clave.slice('planos/'.length);

        const plano = await this.planos.crear(client, {
          id_proyecto: idProyecto,
          id_usuario_subida: idUsuario,
          titulo: datos.titulo,
          descripcion: datos.descripcion,
          url: `/api/proyectos/${idProyecto}/planos/archivos/${nombreArchivo}`,
          s3_key: clave,
        });

        await this.actividades.crear(client, {
          idProyecto,
          idActor: idUsuario,
          tipoAccion: 'PLANO_SUBIDO',
          mensaje: `Plano ${plano.id_plano} subido.`,
        });

        return mapearPlano(plano);
      },
    );
  }
}