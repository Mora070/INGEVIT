import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import {
  ProyectoAccesoRepository,
} from '../../common/repositories/proyecto-acceso.repository';
import {
  ActividadesRepository,
} from '../actividades/actividades.repository';

import { PlanosRepository } from './planos.repository';
import { mapearPlano } from './mappers/plano.mapper';

import type { ActualizarPlanoDto } from './dto/actualizar-plano.dto';
import type { PlanoResponse } from './types/plano.types';

/**
 * Edita los datos descriptivos de un plano.
 *
 * La identidad debe proceder de la sesión autenticada.
 * Los campos deben haber pasado por la validación del DTO.
 *
 * El acceso, la actualización y la actividad utilizan una sola
 * transacción. Si alguna operación falla, no se confirma ninguna.
 */
@Injectable()
export class PlanosEdicionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly acceso: ProyectoAccesoRepository,
    private readonly planos: PlanosRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  async actualizarDatos(
    idProyecto: string,
    idPlano: string,
    idUsuario: string,
    datos: ActualizarPlanoDto,
  ): Promise<PlanoResponse> {
    return this.database.withTransaction(async (client) => {
      const disponible = await this.acceso.bloquearDisponible(
        client,
        idProyecto,
        idUsuario,
      );

      if (!disponible) {
        throw new NotFoundException('El proyecto no está disponible.');
      }

      const plano = await this.planos.actualizarDatos(
        client,
        idProyecto,
        idPlano,
        {
          titulo: datos.titulo,
          descripcion: datos.descripcion,
        },
      );

      if (plano === null) {
        throw new NotFoundException('El plano no está disponible.');
      }

      /*
       * Registra un guardado correcto, incluso si los textos coinciden
       * con los anteriores. No afirma que necesariamente cambiaron.
       * El mensaje no copia el título ni la descripción del usuario.
       */
      await this.actividades.crear(client, {
        idProyecto,
        idActor: idUsuario,
        tipoAccion: 'PLANO_DATOS_GUARDADOS',
        mensaje: `Datos del plano ${plano.id_plano} guardados.`,
      });

      return mapearPlano(plano);
    });
  }
}