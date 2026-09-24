import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import type {
    PrioridadIncidencia,
} from './dto/crear-incidencia.dto';

/**
 * Datos internos de creación.
 * Los identificadores proceden de la ruta y de la sesión.
 */
export interface CrearIncidenciaInput {
    id_proyecto: string;
    id_plano: string;
    id_creador: string;
    titulo: string;
    descripcion: string;
    prioridad: PrioridadIncidencia;
    numero_pagina: number;
    coordenada_x: number;
    coordenada_y: number;
}

/**
 * PostgreSQL devuelve numeric como texto con la configuración actual
 * de pg. Conservamos esa representación en el contrato del repositorio.
 */
export interface IncidenciaRow {
    id_incidencia: string;
    id_proyecto: string;
    id_plano: string;
    id_creador: string;
    titulo: string;
    descripcion: string;
    estado: 'PENDIENTE' | 'EN_PROCESO' | 'SOLUCIONADA';
    prioridad: PrioridadIncidencia;
    numero_pagina: number;
    coordenada_x: string;
    coordenada_y: string;
    fecha_creacion: Date;
}

/**
 * Datos internos para crear una incidencia directamente en el mapa.
 *
 * El servicio obtiene el proyecto de la ruta y el creador de la sesión.
 * Las coordenadas geográficas son obligatorias.
 * No recibe campos de plano ni un estado elegido por el cliente.
 */
export interface CrearIncidenciaMapaInput {
    id_proyecto: string;
    id_creador: string;
    titulo: string;
    descripcion: string;
    prioridad: PrioridadIncidencia;
    latitud: number;
    longitud: number;
}

/**
 * Registro de una incidencia creada directamente en el mapa.
 *
 * Conserva la representación textual de numeric utilizada por pg.
 * Los campos de plano son siempre null para esta operación.
 */
export interface IncidenciaMapaRow
    extends Omit<
        IncidenciaRow,
        'id_plano' | 'numero_pagina' | 'coordenada_x' | 'coordenada_y'
    > {
    id_plano: null;
    numero_pagina: null;
    coordenada_x: null;
    coordenada_y: null;
    latitud: string;
    longitud: string;
}

/** Campos que pueden cambiar en un guardado descriptivo. */
export interface ActualizarIncidenciaInput {
    titulo: string;
    descripcion: string;
    prioridad: IncidenciaRow['prioridad'];
    estado: IncidenciaRow['estado'];
}

@Injectable()
export class IncidenciasRepository {
    /**
     * Participa en la transacción del servicio.
     * El estado inicial se establece aquí, sin recibirlo del cliente.
     */
    async crear(
        client: PoolClient,
        datos: CrearIncidenciaInput,
    ): Promise<IncidenciaRow> {
        const resultado = await client.query<IncidenciaRow>(
            `
        INSERT INTO obra.incidencias (
          id_proyecto, id_plano, id_creador,
          titulo, descripcion, prioridad,
          numero_pagina, coordenada_x, coordenada_y, estado
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDIENTE')
        RETURNING
          id_incidencia, id_proyecto, id_plano, id_creador,
          titulo, descripcion, estado, prioridad,
          numero_pagina, coordenada_x, coordenada_y, fecha_creacion
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

        const incidencia = resultado.rows[0];

        if (
            resultado.rowCount !== 1 ||
            resultado.rows.length !== 1 ||
            !incidencia
        ) {
            throw new Error(
                'La creación de la incidencia no devolvió exactamente un registro.',
            );
        }

        return incidencia;
    }

    /**
 * Inserta una incidencia independiente de cualquier plano.
 *
 * El servicio debe comprobar el acceso al proyecto utilizando
 * el mismo cliente de la transacción.
 *
 * La base de datos comprueba la existencia del proyecto,
 * la integridad de la ubicación y las demás restricciones.
 *
 * No abre ni confirma transacciones. Los errores se propagan
 * para revertir también las operaciones asociadas.
 */
    async crearEnMapa(
        client: PoolClient,
        datos: CrearIncidenciaMapaInput,
    ): Promise<IncidenciaMapaRow> {
        const resultado = await client.query<IncidenciaMapaRow>(
            `
        INSERT INTO obra.incidencias (
          id_proyecto,
          id_creador,
          titulo,
          descripcion,
          prioridad,
          latitud,
          longitud,
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
            ],
        );

        const incidencia = resultado.rows[0];

        if (
            resultado.rowCount !== 1
            || resultado.rows.length !== 1
            || !incidencia
        ) {
            throw new Error(
                'La creación de la incidencia de mapa no devolvió exactamente un registro.',
            );
        }

        return incidencia;
    }

    /**
   * Actualiza una incidencia del plano y proyecto indicados.
   *
   * El servicio debe comprobar los permisos dentro de la misma
   * transacción antes de llamar a este método.
   *
   * No modifica creador, ubicación, fecha ni relaciones.
   */
    async actualizarDatos(
        client: PoolClient,
        idProyecto: string,
        idPlano: string,
        idIncidencia: string,
        datos: ActualizarIncidenciaInput,
    ): Promise<IncidenciaRow | null> {
        const resultado = await client.query<IncidenciaRow>(
            `
        UPDATE obra.incidencias
        SET
          titulo = $4,
          descripcion = $5,
          prioridad = $6,
          estado = $7
        WHERE id_proyecto = $1
          AND id_plano = $2
          AND id_incidencia = $3
        RETURNING
          id_incidencia, id_proyecto, id_plano, id_creador,
          titulo, descripcion, estado, prioridad,
          numero_pagina, coordenada_x, coordenada_y, fecha_creacion
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

        if (resultado.rowCount === 0 && resultado.rows.length === 0) {
            return null;
        }

        const incidencia = resultado.rows[0];

        if (
            resultado.rowCount !== 1 ||
            resultado.rows.length !== 1 ||
            !incidencia
        ) {
            throw new Error(
                'La actualización de la incidencia devolvió un resultado inesperado.',
            );
        }

        return incidencia;
    }

    /**
 * Elimina una incidencia únicamente si pertenece al creador indicado.
 *
 * El servicio debe comprobar previamente el acceso al proyecto
 * y al plano dentro de la misma transacción.
 *
 * La condición de autoría forma parte del DELETE para impedir
 * eliminar incidencias ajenas.
 */
    async eliminarPropia(
        client: PoolClient,
        idProyecto: string,
        idPlano: string,
        idIncidencia: string,
        idCreador: string,
    ): Promise<boolean> {
        const resultado = await client.query<{ id_incidencia: string }>(
            `
        DELETE FROM obra.incidencias
        WHERE id_proyecto = $1
          AND id_plano = $2
          AND id_incidencia = $3
          AND id_creador = $4
        RETURNING id_incidencia
      `,
            [idProyecto, idPlano, idIncidencia, idCreador],
        );

        if (resultado.rowCount === 0 && resultado.rows.length === 0) {
            return false;
        }

        if (
            resultado.rowCount !== 1 ||
            resultado.rows.length !== 1 ||
            resultado.rows[0]?.id_incidencia !== idIncidencia
        ) {
            throw new Error(
                'La eliminación de la incidencia devolvió un resultado inesperado.',
            );
        }

        return true;
    }


    /**
 * Actualiza los datos descriptivos de una incidencia de mapa.
 *
 * El servicio debe comprobar el acceso al proyecto utilizando
 * el mismo cliente de la transacción.
 *
 * Conserva creador, ubicación geográfica, fecha y relaciones.
 * La condición id_plano IS NULL impide modificar incidencias
 * de plano mediante esta operación.
 */
    async actualizarDatosEnMapa(
        client: PoolClient,
        idProyecto: string,
        idIncidencia: string,
        datos: ActualizarIncidenciaInput,
    ): Promise<IncidenciaMapaRow | null> {
        const resultado = await client.query<IncidenciaMapaRow>(
            `
        UPDATE obra.incidencias
        SET
          titulo = $3,
          descripcion = $4,
          prioridad = $5,
          estado = $6
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
          fecha_creacion
      `,
            [
                idProyecto,
                idIncidencia,
                datos.titulo,
                datos.descripcion,
                datos.prioridad,
                datos.estado,
            ],
        );

        if (resultado.rowCount === 0 && resultado.rows.length === 0) {
            return null;
        }

        const incidencia = resultado.rows[0];

        if (
            resultado.rowCount !== 1
            || resultado.rows.length !== 1
            || !incidencia
        ) {
            throw new Error(
                'La actualización de la incidencia de mapa devolvió un resultado inesperado.',
            );
        }

        return incidencia;
    }

    /**
 * Elimina una incidencia de mapa exclusivamente de su creador.
 *
 * El servicio debe comprobar el acceso al proyecto dentro de
 * la misma transacción. La autoría se exige también en el DELETE.
 */
    async eliminarPropiaEnMapa(
        client: PoolClient,
        idProyecto: string,
        idIncidencia: string,
        idCreador: string,
    ): Promise<boolean> {
        const resultado = await client.query<{ id_incidencia: string }>(
            `
        DELETE FROM obra.incidencias
        WHERE id_proyecto = $1::uuid
          AND id_incidencia = $2::uuid
          AND id_creador = $3::uuid
          AND id_plano IS NULL
        RETURNING id_incidencia
      `,
            [idProyecto, idIncidencia, idCreador],
        );

        if (resultado.rowCount === 0 && resultado.rows.length === 0) {
            return false;
        }

        if (
            resultado.rowCount !== 1
            || resultado.rows.length !== 1
            || resultado.rows[0]?.id_incidencia !== idIncidencia
        ) {
            throw new Error(
                'La eliminación de la incidencia de mapa devolvió un resultado inesperado.',
            );
        }

        return true;
    }
}