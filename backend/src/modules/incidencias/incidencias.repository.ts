import {
  Injectable,
} from '@nestjs/common';

import type {
  PoolClient,
} from 'pg';

import type {
  PrioridadIncidencia,
} from './dto/crear-incidencia.dto';

/**
 * Datos internos de creación.
 *
 * Los identificadores proceden
 * de la ruta y de la sesión.
 */
export interface CrearIncidenciaInput {
  id_proyecto: string;

  id_plano: string;

  id_creador: string;

  titulo: string;

  descripcion: string;

  prioridad:
    PrioridadIncidencia;

  numero_pagina: number;

  coordenada_x: number;

  coordenada_y: number;
}

/**
 * PostgreSQL devuelve numeric como texto
 * con la configuración actual de pg.
 *
 * Conservamos esa representación
 * en el contrato del repositorio.
 */
export interface IncidenciaRow {
  id_incidencia:
    string;

  id_proyecto:
    string;

  id_plano:
    string;

  id_creador:
    string;

  titulo:
    string;

  descripcion:
    string;

  estado:
    | 'PENDIENTE'
    | 'EN_PROCESO'
    | 'SOLUCIONADA';

  prioridad:
    PrioridadIncidencia;

  numero_pagina:
    number;

  coordenada_x:
    string;

  coordenada_y:
    string;

  fecha_creacion:
    Date;
}

/**
 * Datos internos para crear
 * una incidencia directamente
 * en el mapa.
 *
 * La ubicación ya debe estar
 * resuelta antes de llegar
 * al repositorio.
 *
 * TEXTO:
 * - id_fotografia = null
 * - id_panoramica = null
 *
 * FOTOGRAFÍA:
 * - id_fotografia contiene
 *   el recurso relacionado
 * - id_panoramica = null
 *
 * PANORÁMICA:
 * - id_fotografia = null
 * - id_panoramica contiene
 *   el recurso relacionado
 */
export interface CrearIncidenciaMapaInput {
  id_proyecto:
    string;

  id_creador:
    string;

  titulo:
    string;

  descripcion:
    string;

  prioridad:
    PrioridadIncidencia;

  latitud:
    number;

  longitud:
    number;

  id_fotografia:
    string | null;

  id_panoramica:
    string | null;
}

/**
 * Representación mínima
 * de un recurso multimedia
 * vinculado a un proyecto.
 *
 * Las coordenadas permanecen
 * por compatibilidad con registros
 * anteriores, aunque la ubicación
 * de una incidencia pertenece
 * actualmente a la incidencia.
 */
export interface RecursoMultimediaUbicacionRow {
  latitud:
    string | null;

  longitud:
    string | null;
}

/**
 * Registro de una incidencia
 * creada directamente en el mapa.
 *
 * Los campos de plano son
 * siempre null.
 *
 * latitud y longitud conservan
 * la representación numeric
 * de PostgreSQL.
 */
export interface IncidenciaMapaRow
  extends Omit<
    IncidenciaRow,
    | 'id_plano'
    | 'numero_pagina'
    | 'coordenada_x'
    | 'coordenada_y'
  > {
  id_plano:
    null;

  numero_pagina:
    null;

  coordenada_x:
    null;

  coordenada_y:
    null;

  latitud:
    string;

  longitud:
    string;

  id_fotografia:
    string | null;

  id_panoramica:
    string | null;
}

/**
 * Campos descriptivos que pueden
 * cambiar en una incidencia.
 *
 * Este contrato se utiliza para
 * incidencias sobre plano y no
 * incluye ubicación geográfica.
 */
export interface ActualizarIncidenciaInput {
  titulo:
    string;

  descripcion:
    string;

  prioridad:
    IncidenciaRow['prioridad'];

  estado:
    IncidenciaRow['estado'];
}

/**
 * Campos editables de una
 * incidencia ubicada sobre el mapa.
 *
 * Extiende los datos descriptivos
 * permitiendo además mover
 * la incidencia geográficamente.
 *
 * No modifica:
 * - creador;
 * - fotografía;
 * - panorámica;
 * - fecha de creación.
 */
export interface ActualizarIncidenciaMapaInput
  extends ActualizarIncidenciaInput {
  latitud:
    number;

  longitud:
    number;
}

@Injectable()
export class IncidenciasRepository {
  /**
   * Crea una incidencia sobre un plano.
   *
   * Las incidencias de plano no utilizan:
   * - latitud
   * - longitud
   * - fotografía
   * - panorámica
   */
  async crear(
    client:
      PoolClient,

    datos:
      CrearIncidenciaInput,
  ): Promise<IncidenciaRow> {
    const resultado =
      await client.query<IncidenciaRow>(
        `
          INSERT INTO obra.incidencias (
            id_proyecto,
            id_plano,
            id_creador,
            titulo,
            descripcion,
            prioridad,
            numero_pagina,
            coordenada_x,
            coordenada_y,
            estado
          )
          VALUES (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            'PENDIENTE'
          )
          RETURNING
            id_incidencia,
            id_proyecto,
            id_plano,
            id_creador,
            titulo,
            descripcion,
            estado,
            prioridad,
            numero_pagina,
            coordenada_x,
            coordenada_y,
            fecha_creacion
        `,
        [
          datos.id_proyecto,
          datos.id_plano,
          datos.id_creador,
          datos.titulo,
          datos.descripcion,
          datos.prioridad,
          datos.numero_pagina,
          datos.coordenada_x,
          datos.coordenada_y,
        ],
      );

    const incidencia =
      resultado.rows[0];

    if (
      resultado.rowCount !==
        1 ||
      resultado.rows.length !==
        1 ||
      !incidencia
    ) {
      throw new Error(
        'La creación de la incidencia no devolvió exactamente un registro.',
      );
    }

    return incidencia;
  }

  /**
   * Obtiene y bloquea de forma
   * compartida una fotografía
   * perteneciente al proyecto.
   *
   * Devuelve null cuando la fotografía
   * no existe dentro del proyecto.
   *
   * Las coordenadas pueden ser null
   * para registros nuevos o antiguos.
   */
  async obtenerFotografiaParaIncidencia(
    client:
      PoolClient,

    idProyecto:
      string,

    idFotografia:
      string,
  ): Promise<
    RecursoMultimediaUbicacionRow |
    null
  > {
    const resultado =
      await client.query<
        RecursoMultimediaUbicacionRow
      >(
        `
          SELECT
            latitud,
            longitud
          FROM obra.fotografias
          WHERE id_proyecto = $1::uuid
            AND id_fotografia = $2::uuid
          FOR SHARE
        `,
        [
          idProyecto,
          idFotografia,
        ],
      );

    if (
      resultado.rowCount ===
        0 &&
      resultado.rows.length ===
        0
    ) {
      return null;
    }

    const fotografia =
      resultado.rows[0];

    if (
      resultado.rowCount !==
        1 ||
      resultado.rows.length !==
        1 ||
      !fotografia
    ) {
      throw new Error(
        'La consulta de la fotografía devolvió un resultado inesperado.',
      );
    }

    return fotografia;
  }

  /**
   * Obtiene y bloquea de forma
   * compartida una panorámica
   * perteneciente al proyecto.
   *
   * Devuelve null cuando la panorámica
   * no existe dentro del proyecto.
   *
   * Las coordenadas pueden ser null.
   */
  async obtenerPanoramicaParaIncidencia(
    client:
      PoolClient,

    idProyecto:
      string,

    idPanoramica:
      string,
  ): Promise<
    RecursoMultimediaUbicacionRow |
    null
  > {
    const resultado =
      await client.query<
        RecursoMultimediaUbicacionRow
      >(
        `
          SELECT
            latitud,
            longitud
          FROM obra.panoramicas
          WHERE id_proyecto = $1::uuid
            AND id_panoramica = $2::uuid
          FOR SHARE
        `,
        [
          idProyecto,
          idPanoramica,
        ],
      );

    if (
      resultado.rowCount ===
        0 &&
      resultado.rows.length ===
        0
    ) {
      return null;
    }

    const panoramica =
      resultado.rows[0];

    if (
      resultado.rowCount !==
        1 ||
      resultado.rows.length !==
        1 ||
      !panoramica
    ) {
      throw new Error(
        'La consulta de la panorámica devolvió un resultado inesperado.',
      );
    }

    return panoramica;
  }

  /**
   * Crea una incidencia geográfica
   * directamente en el mapa.
   *
   * El servicio debe haber:
   * - comprobado acceso al proyecto;
   * - validado la relación multimedia;
   * - determinado la ubicación.
   *
   * El repositorio conserva:
   * - sin plano;
   * - sin página;
   * - sin coordenadas X/Y;
   * - ubicación geográfica obligatoria.
   */
  async crearEnMapa(
    client:
      PoolClient,

    datos:
      CrearIncidenciaMapaInput,
  ): Promise<IncidenciaMapaRow> {
    const resultado =
      await client.query<
        IncidenciaMapaRow
      >(
        `
          INSERT INTO obra.incidencias (
            id_proyecto,
            id_creador,
            titulo,
            descripcion,
            prioridad,
            latitud,
            longitud,
            id_fotografia,
            id_panoramica,
            id_plano,
            numero_pagina,
            coordenada_x,
            coordenada_y,
            estado
          )
          VALUES (
            $1::uuid,
            $2::uuid,
            $3,
            $4,
            $5,
            $6::numeric,
            $7::numeric,
            $8::uuid,
            $9::uuid,
            NULL,
            NULL,
            NULL,
            NULL,
            'PENDIENTE'
          )
          RETURNING
            id_incidencia,
            id_proyecto,
            id_plano,
            id_creador,
            titulo,
            descripcion,
            estado,
            prioridad,
            numero_pagina,
            coordenada_x,
            coordenada_y,
            latitud,
            longitud,
            id_fotografia,
            id_panoramica,
            fecha_creacion
        `,
        [
          datos.id_proyecto,
          datos.id_creador,
          datos.titulo,
          datos.descripcion,
          datos.prioridad,
          datos.latitud,
          datos.longitud,
          datos.id_fotografia,
          datos.id_panoramica,
        ],
      );

    const incidencia =
      resultado.rows[0];

    if (
      resultado.rowCount !==
        1 ||
      resultado.rows.length !==
        1 ||
      !incidencia
    ) {
      throw new Error(
        'La creación de la incidencia de mapa no devolvió exactamente un registro.',
      );
    }

    return incidencia;
  }

  /**
   * Actualiza una incidencia de plano.
   *
   * No modifica:
   * - creador;
   * - ubicación;
   * - fecha;
   * - relaciones.
   */
  async actualizarDatos(
    client:
      PoolClient,

    idProyecto:
      string,

    idPlano:
      string,

    idIncidencia:
      string,

    datos:
      ActualizarIncidenciaInput,
  ): Promise<
    IncidenciaRow |
    null
  > {
    const resultado =
      await client.query<
        IncidenciaRow
      >(
        `
          UPDATE obra.incidencias
          SET
            titulo = $4,
            descripcion = $5,
            prioridad = $6,
            estado = $7
          WHERE id_proyecto = $1::uuid
            AND id_plano = $2::uuid
            AND id_incidencia = $3::uuid
          RETURNING
            id_incidencia,
            id_proyecto,
            id_plano,
            id_creador,
            titulo,
            descripcion,
            estado,
            prioridad,
            numero_pagina,
            coordenada_x,
            coordenada_y,
            fecha_creacion
        `,
        [
          idProyecto,
          idPlano,
          idIncidencia,
          datos.titulo,
          datos.descripcion,
          datos.prioridad,
          datos.estado,
        ],
      );

    if (
      resultado.rowCount ===
        0 &&
      resultado.rows.length ===
        0
    ) {
      return null;
    }

    const incidencia =
      resultado.rows[0];

    if (
      resultado.rowCount !==
        1 ||
      resultado.rows.length !==
        1 ||
      !incidencia
    ) {
      throw new Error(
        'La actualización de la incidencia devolvió un resultado inesperado.',
      );
    }

    return incidencia;
  }

  /**
   * Elimina una incidencia de plano
   * únicamente si pertenece
   * al creador.
   */
  async eliminarPropia(
    client:
      PoolClient,

    idProyecto:
      string,

    idPlano:
      string,

    idIncidencia:
      string,

    idCreador:
      string,
  ): Promise<boolean> {
    const resultado =
      await client.query<{
        id_incidencia:
          string;
      }>(
        `
          DELETE FROM obra.incidencias
          WHERE id_proyecto = $1::uuid
            AND id_plano = $2::uuid
            AND id_incidencia = $3::uuid
            AND id_creador = $4::uuid
          RETURNING id_incidencia
        `,
        [
          idProyecto,
          idPlano,
          idIncidencia,
          idCreador,
        ],
      );

    if (
      resultado.rowCount ===
        0 &&
      resultado.rows.length ===
        0
    ) {
      return false;
    }

    if (
      resultado.rowCount !==
        1 ||
      resultado.rows.length !==
        1 ||
      resultado.rows[0]
        ?.id_incidencia !==
        idIncidencia
    ) {
      throw new Error(
        'La eliminación de la incidencia devolvió un resultado inesperado.',
      );
    }

    return true;
  }

  /**
   * Actualiza una incidencia
   * geográfica del mapa.
   *
   * Permite modificar:
   * - título;
   * - descripción;
   * - prioridad;
   * - estado;
   * - latitud;
   * - longitud.
   *
   * Conserva:
   * - creador;
   * - fotografía;
   * - panorámica;
   * - fecha.
   */
  async actualizarDatosEnMapa(
    client:
      PoolClient,

    idProyecto:
      string,

    idIncidencia:
      string,

    datos:
      ActualizarIncidenciaMapaInput,
  ): Promise<
    IncidenciaMapaRow |
    null
  > {
    const resultado =
      await client.query<
        IncidenciaMapaRow
      >(
        `
          UPDATE obra.incidencias
          SET
            titulo = $3,
            descripcion = $4,
            prioridad = $5,
            estado = $6,
            latitud = $7::numeric,
            longitud = $8::numeric
          WHERE id_proyecto = $1::uuid
            AND id_incidencia = $2::uuid
            AND id_plano IS NULL
          RETURNING
            id_incidencia,
            id_proyecto,
            id_plano,
            id_creador,
            titulo,
            descripcion,
            estado,
            prioridad,
            numero_pagina,
            coordenada_x,
            coordenada_y,
            latitud,
            longitud,
            id_fotografia,
            id_panoramica,
            fecha_creacion
        `,
        [
          idProyecto,
          idIncidencia,
          datos.titulo,
          datos.descripcion,
          datos.prioridad,
          datos.estado,
          datos.latitud,
          datos.longitud,
        ],
      );

    if (
      resultado.rowCount ===
        0 &&
      resultado.rows.length ===
        0
    ) {
      return null;
    }

    const incidencia =
      resultado.rows[0];

    if (
      resultado.rowCount !==
        1 ||
      resultado.rows.length !==
        1 ||
      !incidencia
    ) {
      throw new Error(
        'La actualización de la incidencia de mapa devolvió un resultado inesperado.',
      );
    }

    return incidencia;
  }

  /**
   * Elimina una incidencia de mapa
   * exclusivamente si pertenece
   * a su creador.
   */
  async eliminarPropiaEnMapa(
    client:
      PoolClient,

    idProyecto:
      string,

    idIncidencia:
      string,

    idCreador:
      string,
  ): Promise<boolean> {
    const resultado =
      await client.query<{
        id_incidencia:
          string;
      }>(
        `
          DELETE FROM obra.incidencias
          WHERE id_proyecto = $1::uuid
            AND id_incidencia = $2::uuid
            AND id_creador = $3::uuid
            AND id_plano IS NULL
          RETURNING id_incidencia
        `,
        [
          idProyecto,
          idIncidencia,
          idCreador,
        ],
      );

    if (
      resultado.rowCount ===
        0 &&
      resultado.rows.length ===
        0
    ) {
      return false;
    }

    if (
      resultado.rowCount !==
        1 ||
      resultado.rows.length !==
        1 ||
      resultado.rows[0]
        ?.id_incidencia !==
        idIncidencia
    ) {
      throw new Error(
        'La eliminación de la incidencia de mapa devolvió un resultado inesperado.',
      );
    }

    return true;
  }
}