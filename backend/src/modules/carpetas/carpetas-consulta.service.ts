import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  DatabaseService,
} from '../../database/database.service';

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
  CarpetaResponse,
  CarpetaRow,
} from './types/carpeta.types';


export interface FotografiaCarpetaResponse {
  id_fotografia: string;
  id_proyecto: string;
  id_usuario_subida: string;

  titulo: string;
  url: string;

  latitud: number | null;
  longitud: number | null;

  fecha_subida: string;
  es_portada: boolean;

  fecha_agregada: string;
}


export interface PanoramicaCarpetaResponse {
  id_panoramica: string;
  id_proyecto: string;
  id_usuario_subida: string;

  titulo: string;
  url: string;

  mime_type:
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

  fecha_subida: string;

  latitud: number | null;
  longitud: number | null;

  fecha_agregada: string;
}


export interface PlanoCarpetaResponse {
  id_plano: string;
  id_proyecto: string;
  id_usuario_subida: string;

  titulo: string;
  descripcion: string;

  url: string;
  mime_type:
  'application/pdf';

  fecha_subida: string;
  fecha_agregada: string;
}


export interface ContenidoCarpetaResponse {
  carpeta: CarpetaResponse;

  subcarpetas:
  CarpetaResponse[];

  fotografias:
  FotografiaCarpetaResponse[];

  panoramicas:
  PanoramicaCarpetaResponse[];

  planos:
  PlanoCarpetaResponse[];
}


function mapearCarpeta(
  carpeta: CarpetaRow,
): CarpetaResponse {
  return {
    id_carpeta:
      carpeta.id_carpeta,

    id_proyecto:
      carpeta.id_proyecto,

    id_carpeta_padre:
      carpeta.id_carpeta_padre,

    id_usuario_creacion:
      carpeta.id_usuario_creacion,

    nombre:
      carpeta.nombre,

    fecha_creacion:
      carpeta.fecha_creacion
        .toISOString(),

    fecha_actualizacion:
      carpeta.fecha_actualizacion
        .toISOString(),
  };
}


function mapearCoordenada(
  valor:
    | string
    | number
    | null,
): number | null {
  if (
    valor === null
  ) {
    return null;
  }

  const numero =
    Number(
      valor,
    );

  return Number.isFinite(
    numero,
  )
    ? numero
    : null;
}


/**
 * Consulta la estructura organizativa
 * de carpetas del proyecto.
 *
 * Nunca expone claves internas
 * de almacenamiento.
 */
@Injectable()
export class CarpetasConsultaService {
  constructor(
    private readonly database:
      DatabaseService,

    private readonly acceso:
      CarpetasAccesoRepository,

    private readonly carpetas:
      CarpetasRepository,

    private readonly recursos:
      CarpetasRecursosRepository,
  ) { }

  /**
   * Lista las carpetas ubicadas directamente
   * bajo una carpeta padre.
   *
   * idCarpetaPadre = null devuelve las
   * carpetas de la raíz.
   */
  async listar(
    idProyecto: string,
    idUsuario: string,
    idCarpetaPadre:
      string | null,
  ): Promise<CarpetaResponse[]> {
    return this.database.withTransaction(
      async (
        client,
      ) => {
        const disponible =
          await this.acceso.estaDisponible(
            client,
            idProyecto,
            idUsuario,
          );

        if (
          !disponible
        ) {
          throw new NotFoundException(
            'El proyecto no está disponible para consultar carpetas.',
          );
        }

        /*
         * Si estamos consultando una carpeta
         * concreta como padre, confirmamos
         * primero que exista en este proyecto.
         */
        if (
          idCarpetaPadre !==
          null
        ) {
          const padre =
            await this.carpetas.buscarPorId(
              client,
              idProyecto,
              idCarpetaPadre,
            );

          if (
            !padre
          ) {
            throw new NotFoundException(
              'La carpeta no existe o no pertenece al proyecto.',
            );
          }
        }

        const carpetas =
          await this.carpetas.listarPorPadre(
            client,
            idProyecto,
            idCarpetaPadre,
          );

        return carpetas.map(
          mapearCarpeta,
        );
      },
    );
  }


  /**
   * Devuelve una carpeta junto con:
   *
   * - sus subcarpetas directas;
   * - fotografías;
   * - panorámicas;
   * - planos.
   *
   * No recorre automáticamente todos los
   * descendientes. El frontend navegará
   * nivel por nivel.
   */
  async obtenerContenido(
    idProyecto: string,
    idCarpeta: string,
    idUsuario: string,
  ): Promise<ContenidoCarpetaResponse> {
    return this.database.withTransaction(
      async (
        client,
      ) => {
        const disponible =
          await this.acceso.estaDisponible(
            client,
            idProyecto,
            idUsuario,
          );

        if (
          !disponible
        ) {
          throw new NotFoundException(
            'El proyecto no está disponible para consultar carpetas.',
          );
        }

        const carpeta =
          await this.carpetas.buscarPorId(
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

        const [
          subcarpetas,
          contenido,
        ] =
          await Promise.all([
            this.carpetas.listarPorPadre(
              client,
              idProyecto,
              idCarpeta,
            ),

            this.recursos.listarContenido(
              client,
              idProyecto,
              idCarpeta,
            ),
          ]);

        return {
          carpeta:
            mapearCarpeta(
              carpeta,
            ),

          subcarpetas:
            subcarpetas.map(
              mapearCarpeta,
            ),

          fotografias:
            contenido.fotografias.map(
              (
                fotografia,
              ) => ({
                id_fotografia:
                  fotografia.id_fotografia,

                id_proyecto:
                  fotografia.id_proyecto,

                id_usuario_subida:
                  fotografia.id_usuario_subida,

                titulo:
                  fotografia.titulo,

                url:
                  fotografia.url,

                latitud:
                  mapearCoordenada(
                    fotografia.latitud,
                  ),

                longitud:
                  mapearCoordenada(
                    fotografia.longitud,
                  ),

                fecha_subida:
                  fotografia.fecha_subida
                    .toISOString(),

                es_portada:
                  fotografia.es_portada,

                fecha_agregada:
                  fotografia.fecha_agregada
                    .toISOString(),
              }),
            ),

          panoramicas:
            contenido.panoramicas.map(
              (
                panoramica,
              ) => ({
                id_panoramica:
                  panoramica.id_panoramica,

                id_proyecto:
                  panoramica.id_proyecto,

                id_usuario_subida:
                  panoramica.id_usuario_subida,

                titulo:
                  panoramica.titulo,

                url:
                  panoramica.url,

                mime_type:
                  panoramica.mime_type,

                fecha_subida:
                  panoramica.fecha_subida
                    .toISOString(),

                latitud:
                  mapearCoordenada(
                    panoramica.latitud,
                  ),

                longitud:
                  mapearCoordenada(
                    panoramica.longitud,
                  ),

                fecha_agregada:
                  panoramica.fecha_agregada
                    .toISOString(),
              }),
            ),

          planos:
            contenido.planos.map(
              (
                plano,
              ) => ({
                id_plano:
                  plano.id_plano,

                id_proyecto:
                  plano.id_proyecto,

                id_usuario_subida:
                  plano.id_usuario_subida,

                titulo:
                  plano.titulo,

                descripcion:
                  plano.descripcion,

                url:
                  plano.url,

                mime_type:
                  plano.mime_type,

                fecha_subida:
                  plano.fecha_subida
                    .toISOString(),

                fecha_agregada:
                  plano.fecha_agregada
                    .toISOString(),
              }),
            ),
        };
      },
    );
  }
}