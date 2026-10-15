
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  DatabaseService,
} from '../../database/database.service';

import {
  ProyectoAccesoRepository,
} from '../../common/repositories/proyecto-acceso.repository';

import {
  ActividadesRepository,
} from '../actividades/actividades.repository';

import {
  NotificacionesRepository,
} from '../notificaciones/notificaciones.repository';

import {
  PanoramicasPersistenciaService,
} from './panoramicas-persistencia.service';

import {
  PanoramicasRepository,
} from './panoramicas.repository';

import {
  normalizarPanoramica,
} from './utils/normalizar-panoramica';

import {
  mapearPanoramica,
} from './mappers/panoramica.mapper';

import type {
  SubirPanoramicaDto,
} from './dto/subir-panoramica.dto';

import type {
  PanoramicaResponse,
} from './types/panoramica.types';

@Injectable()
export class PanoramicasSubidaService {
  constructor(
    private readonly database:
      DatabaseService,

    private readonly acceso:
      ProyectoAccesoRepository,

    private readonly persistencia:
      PanoramicasPersistenciaService,

    private readonly panoramicas:
      PanoramicasRepository,

    private readonly actividades:
      ActividadesRepository,

    private readonly notificaciones:
      NotificacionesRepository,
  ) {}

  async subir(
    idProyecto: string,
    idUsuario: string,
    datos: SubirPanoramicaDto,
    contenido: Buffer,
  ): Promise<PanoramicaResponse> {

    /*
     * ====================================================
     * 1. VERIFICAR ACCESO AL PROYECTO
     * ====================================================
     */

    const disponible =
      await this.database.withTransaction(
        (client) =>
          this.acceso.bloquearDisponible(
            client,
            idProyecto,
            idUsuario,
          ),
      );

    if (!disponible) {
      throw new NotFoundException(
        'El proyecto no está disponible.',
      );
    }

    /*
     * ====================================================
     * 2. VALIDAR Y NORMALIZAR LA PANORÁMICA
     * ====================================================
     *
     * El normalizador:
     *
     * - Inspecciona el contenido real de la imagen.
     * - Comprueba formato, resolución y proporción.
     * - Conserva imágenes que ya son 2:1.
     * - Ajusta las imágenes compatibles a 2:1.
     * - No estira ni deforma la fotografía.
     * - Verifica el resultado generado.
     *
     * El archivo resultante será el que se almacene.
     */

    const panoramicaNormalizada =
      await normalizarPanoramica(
        contenido,
      );

    /*
     * ====================================================
     * 3. ALMACENAR PANORÁMICA NORMALIZADA
     * ====================================================
     *
     * Se conserva el coordinador de persistencia
     * existente, incluyendo su gestión de transacciones
     * y limpieza ante errores.
     */

    return this.persistencia.guardarYRegistrar(
      panoramicaNormalizada.contenido,
      panoramicaNormalizada.formato,

      async (
        client,
        clave,
      ) => {

        /*
         * ================================================
         * 4. VOLVER A VERIFICAR ACCESO
         * ================================================
         */

        const sigueDisponible =
          await this.acceso.bloquearDisponible(
            client,
            idProyecto,
            idUsuario,
          );

        if (!sigueDisponible) {
          throw new NotFoundException(
            'El proyecto no está disponible.',
          );
        }

        /*
         * ================================================
         * 5. CONSTRUIR URL DEL ARCHIVO
         * ================================================
         */

        const nombreArchivo =
          clave.slice(
            'panoramicas/'.length,
          );

        /*
         * ================================================
         * 6. REGISTRAR PANORÁMICA EN POSTGRESQL
         * ================================================
         */

        const panoramica =
          await this.panoramicas.crear(
            client,
            {
              id_proyecto:
                idProyecto,

              id_usuario_subida:
                idUsuario,

              titulo:
                datos.titulo,

              url:
                `/api/proyectos/${idProyecto}/panoramicas/archivos/${nombreArchivo}`,

              s3_key:
                clave,

              mime_type:
                panoramicaNormalizada.mimeType,
            },
          );

        /*
         * ================================================
         * 7. REGISTRAR ACTIVIDAD
         * ================================================
         */

        await this.actividades.crear(
          client,
          {
            idProyecto,

            idActor:
              idUsuario,

            tipoAccion:
              'PANORAMICA_SUBIDA',

            mensaje:
              `Panorámica ${panoramica.id_panoramica} subida.`,
          },
        );

        /*
         * ================================================
         * 8. NOTIFICAR A LOS PARTICIPANTES
         * ================================================
         */

        await this.notificaciones.crearParaParticipantesProyecto(
          client,
          {
            id_actor:
              idUsuario,

            id_proyecto:
              idProyecto,

            id_incidencia:
              null,

            tipo:
              'PANORAMICA_CREADA',

            titulo:
              'Nueva panorámica 360°',

            mensaje:
              `Se agregó la panorámica "${panoramica.titulo}".`,

            destino:
              'PANORAMICAS',

            id_recurso:
              panoramica.id_panoramica,
          },
        );

        /*
         * ================================================
         * 9. DEVOLVER RESPUESTA
         * ================================================
         */

        return mapearPanoramica(
          panoramica,
        );
      },
    );
  }
}
