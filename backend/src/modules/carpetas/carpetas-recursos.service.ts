import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  DatabaseService,
} from '../../database/database.service';

import {
  ActividadesRepository,
} from '../actividades/actividades.repository';

import {
  CarpetasAccesoRepository,
} from './carpetas-acceso.repository';

import {
  CarpetasRepository,
} from './carpetas.repository';

import {
  CarpetasRecursosRepository,
} from './carpetas-recursos.repository';

import type {
  AgregarRecursoCarpetaDto,
} from './dto/agregar-recurso-carpeta.dto';


/**
 * Organiza recursos existentes dentro
 * de carpetas del proyecto.
 *
 * No crea copias físicas de archivos.
 *
 * Si el recurso ya pertenece a otra carpeta,
 * la relación se actualiza y el recurso se mueve.
 */
@Injectable()
export class CarpetasRecursosService {
  constructor(
    private readonly database:
      DatabaseService,

    private readonly acceso:
      CarpetasAccesoRepository,

    private readonly carpetas:
      CarpetasRepository,

    private readonly recursos:
      CarpetasRecursosRepository,

    private readonly actividades:
      ActividadesRepository,
  ) {}

  async agregar(
    idProyecto: string,
    idCarpeta: string,
    idUsuario: string,
    datos: AgregarRecursoCarpetaDto,
  ): Promise<void> {
    await this.database.withTransaction(
      async (
        client,
      ) => {
        const disponible =
          await this.acceso.bloquearDisponible(
            client,
            idProyecto,
            idUsuario,
          );

        if (
          !disponible
        ) {
          throw new NotFoundException(
            'El proyecto no está disponible para gestionar carpetas.',
          );
        }

        const carpeta =
          await this.carpetas.bloquear(
            client,
            idProyecto,
            idCarpeta,
          );

        if (
          !carpeta
        ) {
          throw new NotFoundException(
            'La carpeta no existe o no pertenece al proyecto.',
          );
        }

        let agregado =
          false;

        let tipoAccion =
          '';

        let mensaje =
          '';

        switch (
          datos.tipo
        ) {
          case 'FOTOGRAFIA':
            agregado =
              await this.recursos.agregarFotografia(
                client,
                idProyecto,
                idCarpeta,
                datos.id_recurso,
                idUsuario,
              );

            tipoAccion =
              'CARPETA_FOTOGRAFIA_AGREGADA';

            mensaje =
              `Fotografía ${datos.id_recurso} organizada en la carpeta "${carpeta.nombre}".`;

            break;

          case 'PANORAMICA':
            agregado =
              await this.recursos.agregarPanoramica(
                client,
                idProyecto,
                idCarpeta,
                datos.id_recurso,
                idUsuario,
              );

            tipoAccion =
              'CARPETA_PANORAMICA_AGREGADA';

            mensaje =
              `Panorámica ${datos.id_recurso} organizada en la carpeta "${carpeta.nombre}".`;

            break;

          case 'PLANO':
            agregado =
              await this.recursos.agregarPlano(
                client,
                idProyecto,
                idCarpeta,
                datos.id_recurso,
                idUsuario,
              );

            tipoAccion =
              'CARPETA_PLANO_AGREGADO';

            mensaje =
              `Plano ${datos.id_recurso} organizado en la carpeta "${carpeta.nombre}".`;

            break;
        }

        if (
          !agregado
        ) {
          throw new NotFoundException(
            'El recurso no existe o no pertenece al proyecto.',
          );
        }

        await this.actividades.crear(
          client,
          {
            idProyecto,

            idActor:
              idUsuario,

            tipoAccion,

            mensaje,
          },
        );
      },
    );
  }


  async quitar(
    idProyecto: string,
    idCarpeta: string,
    idUsuario: string,
    tipo:
      | 'FOTOGRAFIA'
      | 'PANORAMICA'
      | 'PLANO',
    idRecurso: string,
  ): Promise<void> {
    await this.database.withTransaction(
      async (
        client,
      ) => {
        const disponible =
          await this.acceso.bloquearDisponible(
            client,
            idProyecto,
            idUsuario,
          );

        if (
          !disponible
        ) {
          throw new NotFoundException(
            'El proyecto no está disponible para gestionar carpetas.',
          );
        }

        const carpeta =
          await this.carpetas.bloquear(
            client,
            idProyecto,
            idCarpeta,
          );

        if (
          !carpeta
        ) {
          throw new NotFoundException(
            'La carpeta no existe o no pertenece al proyecto.',
          );
        }

        let eliminado =
          false;

        let tipoAccion =
          '';

        let mensaje =
          '';

        switch (
          tipo
        ) {
          case 'FOTOGRAFIA':
            eliminado =
              await this.recursos.quitarFotografia(
                client,
                idProyecto,
                idCarpeta,
                idRecurso,
              );

            tipoAccion =
              'CARPETA_FOTOGRAFIA_ELIMINADA';

            mensaje =
              `Fotografía ${idRecurso} retirada de la carpeta "${carpeta.nombre}".`;

            break;

          case 'PANORAMICA':
            eliminado =
              await this.recursos.quitarPanoramica(
                client,
                idProyecto,
                idCarpeta,
                idRecurso,
              );

            tipoAccion =
              'CARPETA_PANORAMICA_ELIMINADA';

            mensaje =
              `Panorámica ${idRecurso} retirada de la carpeta "${carpeta.nombre}".`;

            break;

          case 'PLANO':
            eliminado =
              await this.recursos.quitarPlano(
                client,
                idProyecto,
                idCarpeta,
                idRecurso,
              );

            tipoAccion =
              'CARPETA_PLANO_ELIMINADO';

            mensaje =
              `Plano ${idRecurso} retirado de la carpeta "${carpeta.nombre}".`;

            break;
        }

        /*
         * Solo elimina la relación organizativa.
         * El recurso original permanece intacto.
         */
        if (
          !eliminado
        ) {
          throw new NotFoundException(
            'El recurso no se encuentra dentro de esta carpeta.',
          );
        }

        await this.actividades.crear(
          client,
          {
            idProyecto,

            idActor:
              idUsuario,

            tipoAccion,

            mensaje,
          },
        );
      },
    );
  }
}