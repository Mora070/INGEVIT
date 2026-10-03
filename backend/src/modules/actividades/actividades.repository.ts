import { Injectable } from '@nestjs/common';

import type {
  PoolClient,
} from 'pg';

import type {
  CrearActividadInput,
} from './types/crear-actividad.types';

type RecursoTiempoReal =
  | 'FOTOGRAFIAS'
  | 'PANORAMICAS'
  | 'PLANOS'
  | 'ORTOFOTOS'
  | 'INCIDENCIAS'
  | 'CARPETAS';

function obtenerRecursoTiempoReal(
  tipoAccion: string,
): RecursoTiempoReal | null {
  switch (
    tipoAccion
  ) {
    case 'FOTOGRAFIA_SUBIDA':
    case 'FOTOGRAFIA_TITULO_GUARDADO':
    case 'FOTOGRAFIA_PORTADA_ESTABLECIDA':
    case 'FOTOGRAFIA_ELIMINADA':
      return 'FOTOGRAFIAS';

    case 'PANORAMICA_SUBIDA':
    case 'PANORAMICA_TITULO_GUARDADO':
    case 'PANORAMICA_ELIMINADA':
      return 'PANORAMICAS';

    case 'PLANO_SUBIDO':
    case 'PLANO_DATOS_GUARDADOS':
    case 'PLANO_ELIMINADO':
      return 'PLANOS';

    case 'CAPA_CREADA':
    case 'CAPA_CONFIGURACION_GUARDADA':
    case 'CAPA_PROCESADA':
    case 'CAPA_REINTENTO_SOLICITADO':
    case 'CAPA_ELIMINADA':
      return 'ORTOFOTOS';

    case 'INCIDENCIA_CREADA':
    case 'INCIDENCIA_DATOS_GUARDADOS':
    case 'INCIDENCIA_ELIMINADA':
      return 'INCIDENCIAS';

    case 'CARPETA_CREADA':
    case 'CARPETA_NOMBRE_GUARDADO':
    case 'CARPETA_MOVIDA':
    case 'CARPETA_ELIMINADA':
    case 'CARPETA_FOTOGRAFIA_AGREGADA':
    case 'CARPETA_FOTOGRAFIA_ELIMINADA':
    case 'CARPETA_PANORAMICA_AGREGADA':
    case 'CARPETA_PANORAMICA_ELIMINADA':
    case 'CARPETA_PLANO_AGREGADO':
    case 'CARPETA_PLANO_ELIMINADO':
      return 'CARPETAS';

    default:
      return null;
  }
}

/**
 * Registra el historial de acciones de los proyectos.
 *
 * Las escrituras utilizan una conexión proporcionada por el servicio
 * que coordina la operación de negocio.
 *
 * No crea otro pool ni administra la transacción.
 */
@Injectable()
export class ActividadesRepository {
  /**
   * Inserta una actividad dentro de la transacción del llamador.
   *
   * Si la inserción falla, el error se propaga para que
   * DatabaseService.withTransaction() revierta la operación completa.
   *
   * Para cambios de recursos del proyecto también programa
   * una notificación PostgreSQL para los usuarios que
   * actualmente participan en el proyecto.
   *
   * pg_notify ejecutado dentro de una transacción solo se entrega
   * cuando esa transacción se confirma correctamente.
   */
  async crear(
    client: PoolClient,
    datos: CrearActividadInput,
  ): Promise<void> {
    const result =
      await client.query(
        `
          INSERT INTO obra.actividades (
            id_proyecto,
            id_actor,
            tipo_accion,
            mensaje
          )
          VALUES (
            $1::uuid,
            $2::uuid,
            $3,
            $4
          )
        `,
        [
          datos.idProyecto,
          datos.idActor,
          datos.tipoAccion,
          datos.mensaje,
        ],
      );

    /**
     * Una inserción individual debe registrar exactamente una fila.
     * Un resultado diferente impide confirmar la operación sin historial.
     */
    if (
      result.rowCount !==
      1
    ) {
      throw new Error(
        'No se pudo registrar la actividad del proyecto.',
      );
    }

    const recurso =
      obtenerRecursoTiempoReal(
        datos.tipoAccion,
      );

    if (
      recurso === null
    ) {
      return;
    }

    /**
     * Envía el cambio al propietario y a todos los colaboradores
     * activos que actualmente pertenecen al proyecto.
     *
     * UNION evita duplicados.
     *
     * Como esta consulta utiliza el mismo cliente transaccional,
     * PostgreSQL no entrega el NOTIFY hasta que el COMMIT sea exitoso.
     */
    await client.query(
      `
        WITH destinatarios AS (
          SELECT
            proyecto.id_propietario
              AS id_usuario
          FROM obra.proyectos
            AS proyecto
          WHERE proyecto.id_proyecto =
            $1::uuid
            AND proyecto.activo = TRUE

          UNION

          SELECT
            colaboracion.id_usuario
          FROM obra.usuario_proyecto
            AS colaboracion
          WHERE colaboracion.id_proyecto =
            $1::uuid
        )
        SELECT pg_notify(
          'proyecto_cambios',
          json_build_object(
            'id_usuario',
            destinatario.id_usuario::text,

            'id_proyecto',
            $1::uuid::text,

            'recurso',
            $2::text
          )::text
        )
        FROM destinatarios
          AS destinatario
        INNER JOIN obra.usuarios
          AS usuario
          ON usuario.id_usuario =
            destinatario.id_usuario
        WHERE usuario.estado =
          'ACTIVO'
      `,
      [
        datos.idProyecto,
        recurso,
      ],
    );
  }
}