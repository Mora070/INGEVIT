import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import type { ProyectoRow } from './types/proyecto.types';

import type { PoolClient } from 'pg';
import type { CrearProyectoInput } from './types/crear-proyecto.types';
import type { ActualizarProyectoInput } from './types/actualizar-proyecto.types';

import type {
  ProyectoPaginaConsultaRow,
  ProyectosPaginadosRow,
} from './types/proyectos-paginados-row.types';

/**
 * Acceso a PostgreSQL para proyectos.
 *
 * Utiliza parámetros para los valores externos.
 * No recibe un rol global para conceder acceso implícito.
 */
@Injectable()
export class ProyectosRepository {
  constructor(
    private readonly database: DatabaseService,
  ) { }

  /**
   * Consulta los proyectos disponibles para el usuario indicado.
   *
   * Condiciones:
   * - El solicitante existe y está ACTIVO.
   * - El proyecto no está eliminado lógicamente.
   * - Su propietario está ACTIVO.
   * - El solicitante es propietario o colaborador.
   *
   * El identificador debe proceder de la identidad autenticada.
   *
   * No filtra por estado_proyecto:
   * ACTIVA, PAUSA y FINALIZADA son estados de trabajo,
   * no condiciones de eliminación o acceso.
   */
  async findDisponiblesByUsuario(
    idUsuario: string,
  ): Promise<ProyectoRow[]> {
    const result = await this.database.query<ProyectoRow>(
      `
        SELECT
          p.id_proyecto,
          p.id_propietario,
          p.nombre,
          p.descripcion,
          p.direccion,
          p.contratante,
          to_char(p.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
          to_char(
            p.fecha_finalizacion,
            'YYYY-MM-DD'
          ) AS fecha_finalizacion,
          p.estado_proyecto,
          p.activo,
          p.latitud,
          p.longitud
        FROM obra.proyectos AS p
        INNER JOIN obra.usuarios AS propietario
          ON propietario.id_usuario = p.id_propietario
        INNER JOIN obra.usuarios AS solicitante
          ON solicitante.id_usuario = $1::uuid
        WHERE p.activo = true
          AND propietario.estado = 'ACTIVO'
          AND solicitante.estado = 'ACTIVO'
          AND (
            p.id_propietario = solicitante.id_usuario
            OR EXISTS (
              SELECT 1
              FROM obra.usuario_proyecto AS colaboracion
              WHERE colaboracion.id_proyecto = p.id_proyecto
                AND colaboracion.id_usuario = solicitante.id_usuario
            )
          )
        ORDER BY
          p.fecha_inicio DESC,
          p.id_proyecto ASC
      `,
      [idUsuario],
    );

    return result.rows;
  }

  /**
   * Consulta una página y el total de proyectos accesibles.
   *
   * Los filtros de acceso se definen una sola vez en la CTE.
   * El conteo y la página utilizan el mismo conjunto de proyectos.
   *
   * Precondiciones:
   * - idUsuario procede de la autenticación.
   * - pagina y limite fueron validados.
   *
   * Una página sin registros conserva el total y devuelve proyectos: [].
   */
  async findDisponiblesPaginadosByUsuario(
    idUsuario: string,
    pagina: number,
    limite: number,
  ): Promise<ProyectosPaginadosRow> {
    const desplazamiento = (pagina - 1) * limite;

    const result =
      await this.database.query<ProyectoPaginaConsultaRow>(
        `
        WITH accesibles AS (
          SELECT p.*
          FROM obra.proyectos AS p
          INNER JOIN obra.usuarios AS propietario
            ON propietario.id_usuario = p.id_propietario
          INNER JOIN obra.usuarios AS solicitante
            ON solicitante.id_usuario = $1::uuid
          WHERE p.activo = true
            AND propietario.estado = 'ACTIVO'
            AND solicitante.estado = 'ACTIVO'
            AND (
              p.id_propietario = solicitante.id_usuario
              OR EXISTS (
                SELECT 1
                FROM obra.usuario_proyecto AS colaboracion
                WHERE colaboracion.id_proyecto = p.id_proyecto
                  AND colaboracion.id_usuario = solicitante.id_usuario
              )
            )
        ),
        pagina_seleccionada AS (
          SELECT *
          FROM accesibles
          ORDER BY fecha_inicio DESC, id_proyecto ASC
          LIMIT $2::integer
          OFFSET $3::bigint
        ),
        conteo AS (
          SELECT count(*)::text AS total
          FROM accesibles
        )
        SELECT
          p.id_proyecto,
          p.id_propietario,
          p.nombre,
          p.descripcion,
          p.direccion,
          p.contratante,
          to_char(p.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
          to_char(
            p.fecha_finalizacion,
            'YYYY-MM-DD'
          ) AS fecha_finalizacion,
          p.estado_proyecto,
          p.activo,
          p.latitud,
          p.longitud,
          conteo.total
        FROM conteo
        LEFT JOIN pagina_seleccionada AS p ON true
        ORDER BY p.fecha_inicio DESC, p.id_proyecto ASC
      `,
        [idUsuario, limite, desplazamiento],
      );

    /**
     * El agregado COUNT siempre produce una fila, incluso sin proyectos.
     * Una ausencia de filas indicaría un resultado inesperado.
     */
    const primeraFila = result.rows[0];

    if (primeraFila === undefined) {
      throw new Error(
        'La consulta paginada no devolvió el conteo esperado.',
      );
    }

    const total = Number(primeraFila.total);

    if (!Number.isSafeInteger(total) || total < 0) {
      throw new Error(
        'El total de proyectos no puede representarse correctamente.',
      );
    }

    const proyectos: ProyectoRow[] = [];

    for (const fila of result.rows) {
      // Descarta la fila vacía generada por el LEFT JOIN.
      if (fila.id_proyecto === null) {
        continue;
      }

      const { total: totalDeFila, ...proyecto } = fila;
      proyectos.push(proyecto);
    }

    return { proyectos, total };
  }


  /**
 * Consulta un proyecto disponible para el usuario indicado.
 *
 * Comprueba en la misma sentencia:
 * - Proyecto no eliminado lógicamente.
 * - Propietario activo.
 * - Solicitante activo.
 * - Solicitante propietario o colaborador.
 *
 * Devuelve null si el proyecto no existe o no está disponible
 * para ese usuario. No distingue públicamente ambas situaciones.
 *
 * idUsuario debe proceder de la identidad autenticada.
 */
  async findDisponibleById(
    idProyecto: string,
    idUsuario: string,
  ): Promise<ProyectoRow | null> {
    const result = await this.database.query<ProyectoRow>(
      `
      SELECT
        p.id_proyecto,
        p.id_propietario,
        p.nombre,
        p.descripcion,
        p.direccion,
        p.contratante,
        to_char(p.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
        to_char(
          p.fecha_finalizacion,
          'YYYY-MM-DD'
        ) AS fecha_finalizacion,
        p.estado_proyecto,
        p.activo,
        p.latitud,
        p.longitud
      FROM obra.proyectos AS p
      INNER JOIN obra.usuarios AS propietario
        ON propietario.id_usuario = p.id_propietario
      INNER JOIN obra.usuarios AS solicitante
        ON solicitante.id_usuario = $2::uuid
      WHERE p.id_proyecto = $1::uuid
        AND p.activo = true
        AND propietario.estado = 'ACTIVO'
        AND solicitante.estado = 'ACTIVO'
        AND (
          p.id_propietario = solicitante.id_usuario
          OR EXISTS (
            SELECT 1
            FROM obra.usuario_proyecto AS colaboracion
            WHERE colaboracion.id_proyecto = p.id_proyecto
              AND colaboracion.id_usuario = solicitante.id_usuario
          )
        )
    `,
      [idProyecto, idUsuario],
    );

    return result.rows[0] ?? null;
  }

  /**
   * Inserta un proyecto utilizando la conexión de una transacción.
   *
   * El servicio debe proporcionar el cliente recibido de
   * DatabaseService.withTransaction().
   *
   * Este método no inicia, confirma ni revierte la transacción.
   * Tampoco utiliza database.query(), porque eso podría ejecutar
   * la inserción en una conexión diferente.
   *
   * La actividad se insertará con este mismo cliente.
   */
  async crear(
    client: PoolClient,
    datos: CrearProyectoInput,
  ): Promise<ProyectoRow> {
    const result = await client.query<ProyectoRow>(
      `
      INSERT INTO obra.proyectos (
        id_propietario,
        nombre,
        descripcion,
        direccion,
        contratante,
        fecha_inicio,
        fecha_finalizacion,
        estado_proyecto,
        latitud,
        longitud
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        $6::date,
        $7::date,
        $8::obra.estado_proyecto,
        $9::numeric,
        $10::numeric
      )
      RETURNING
        id_proyecto,
        id_propietario,
        nombre,
        descripcion,
        direccion,
        contratante,
        to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
        to_char(
          fecha_finalizacion,
          'YYYY-MM-DD'
        ) AS fecha_finalizacion,
        estado_proyecto,
        activo,
        latitud,
        longitud
    `,
      [
        datos.idPropietario,
        datos.nombre,
        datos.descripcion,
        datos.direccion,
        datos.contratante,
        datos.fechaInicio,
        datos.fechaFinalizacion,
        datos.estadoProyecto,
        datos.latitud,
        datos.longitud,
      ],
    );

    const proyecto = result.rows[0];

    if (proyecto === undefined) {
      throw new Error(
        'La inserción del proyecto no devolvió el registro creado.',
      );
    }

    return proyecto;
  }


  /**
 * Comprueba que el propietario existe y está activo,
 * manteniendo un bloqueo de lectura hasta finalizar la transacción.
 *
 * FOR SHARE permite otras lecturas y creaciones concurrentes,
 * pero bloquea una actualización del estado de esta cuenta
 * mientras se completa la operación.
 *
 * Debe ejecutarse con el mismo cliente de la creación.
 */
  async bloquearPropietarioActivo(
    client: PoolClient,
    idPropietario: string,
  ): Promise<boolean> {
    const result = await client.query(
      `
      SELECT id_usuario
      FROM obra.usuarios
      WHERE id_usuario = $1::uuid
        AND estado = 'ACTIVO'
      FOR SHARE
    `,
      [idPropietario],
    );

    return result.rows.length === 1;
  }

  /**
 * Obtiene y bloquea un proyecto editable por su propietario.
 *
 * Precondición:
 * El servicio debe haber ejecutado bloquearPropietarioActivo()
 * con este mismo cliente y comprobado su resultado.
 *
 * Orden de bloqueo:
 * 1. Cuenta del propietario.
 * 2. Proyecto.
 *
 * Mantendremos este orden en las operaciones de modificación
 * para reducir el riesgo de bloqueos cruzados.
 *
 * Devuelve null si el proyecto:
 * - No existe.
 * - Está eliminado lógicamente.
 * - Pertenece a otro usuario.
 *
 * El bloqueo se libera al confirmar o revertir la transacción.
 */
  async bloquearEditablePorPropietario(
    client: PoolClient,
    idProyecto: string,
    idPropietario: string,
  ): Promise<ProyectoRow | null> {
    const result = await client.query<ProyectoRow>(
      `
      SELECT
        p.id_proyecto,
        p.id_propietario,
        p.nombre,
        p.descripcion,
        p.direccion,
        p.contratante,
        to_char(p.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
        to_char(
          p.fecha_finalizacion,
          'YYYY-MM-DD'
        ) AS fecha_finalizacion,
        p.estado_proyecto,
        p.activo,
        p.latitud,
        p.longitud
      FROM obra.proyectos AS p
      WHERE p.id_proyecto = $1::uuid
        AND p.id_propietario = $2::uuid
        AND p.activo = true
      FOR UPDATE OF p
    `,
      [idProyecto, idPropietario],
    );

    return result.rows[0] ?? null;
  }


  /**
   * Reemplaza los datos editables de un proyecto.
   *
   * Precondiciones:
   * - El propietario fue comprobado y bloqueado como ACTIVO.
   * - El proyecto fue obtenido mediante bloquearEditablePorPropietario().
   * - Todas las operaciones utilizan este mismo cliente transaccional.
   *
   * Repetimos las condiciones de propiedad y eliminación lógica
   * como defensa adicional en la propia escritura.
   *
   * No modifica id_propietario, activo ni relaciones de colaboradores.
   * La actividad será registrada por el servicio antes del COMMIT.
   */
  async actualizar(
    client: PoolClient,
    idProyecto: string,
    idPropietario: string,
    datos: ActualizarProyectoInput,
  ): Promise<ProyectoRow> {
    const result = await client.query<ProyectoRow>(
      `
      UPDATE obra.proyectos
      SET
        nombre = $3,
        descripcion = $4,
        direccion = $5,
        contratante = $6,
        fecha_inicio = $7::date,
        fecha_finalizacion = $8::date,
        estado_proyecto = $9::obra.estado_proyecto,
        latitud = $10::numeric,
        longitud = $11::numeric
      WHERE id_proyecto = $1::uuid
        AND id_propietario = $2::uuid
        AND activo = true
      RETURNING
        id_proyecto,
        id_propietario,
        nombre,
        descripcion,
        direccion,
        contratante,
        to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
        to_char(
          fecha_finalizacion,
          'YYYY-MM-DD'
        ) AS fecha_finalizacion,
        estado_proyecto,
        activo,
        latitud,
        longitud
    `,
      [
        idProyecto,
        idPropietario,
        datos.nombre,
        datos.descripcion,
        datos.direccion,
        datos.contratante,
        datos.fechaInicio,
        datos.fechaFinalizacion,
        datos.estadoProyecto,
        datos.latitud,
        datos.longitud,
      ],
    );

    const proyecto = result.rows[0];

    /**
     * Después de bloquear correctamente el proyecto, esperamos
     * actualizar exactamente esa fila.
     *
     * La ausencia del registro indica una inconsistencia técnica.
     * Propagamos el error para impedir confirmar la transacción.
     */
    if (proyecto === undefined) {
      throw new Error(
        'La actualización del proyecto no devolvió el registro esperado.',
      );
    }

    return proyecto;
  }


  /**
 * Marca un proyecto como eliminado lógicamente.
 *
 * Precondiciones:
 * - La cuenta del propietario fue comprobada y bloqueada como ACTIVO.
 * - El proyecto fue bloqueado mediante bloquearEditablePorPropietario().
 * - Se utiliza el mismo cliente transaccional.
 *
 * Modifica exclusivamente activo.
 * No ejecuta DELETE ni modifica el estado de trabajo.
 *
 * El servicio registrará la actividad antes de confirmar.
 */
  async eliminarLogicamente(
    client: PoolClient,
    idProyecto: string,
    idPropietario: string,
  ): Promise<void> {
    const result = await client.query(
      `
      UPDATE obra.proyectos
      SET activo = false
      WHERE id_proyecto = $1::uuid
        AND id_propietario = $2::uuid
        AND activo = true
    `,
      [idProyecto, idPropietario],
    );

    /**
     * Después del bloqueo esperamos modificar exactamente una fila.
     * Un resultado diferente impide confirmar la operación.
     */
    if (result.rowCount !== 1) {
      throw new Error(
        'No se pudo completar la eliminación lógica del proyecto.',
      );
    }
  }

  /**
   * Comprueba que la cuenta destinataria existe.
   *
   * No exige estado ACTIVO: una relación de colaboración puede
   * conservarse o establecerse para una cuenta inactiva.
   * El estado seguirá impidiendo su acceso al sistema.
   *
   * FOR KEY SHARE evita que la cuenta desaparezca mientras
   * completamos la relación, sin bloquear cambios normales de estado.
   */
  async bloquearUsuarioExistente(
    client: PoolClient,
    idUsuario: string,
  ): Promise<boolean> {
    const result = await client.query(
      `
      SELECT id_usuario
      FROM obra.usuarios
      WHERE id_usuario = $1::uuid
      FOR KEY SHARE
    `,
      [idUsuario],
    );

    return result.rows.length === 1;
  }

  /**
   * Agrega una relación de colaboración si todavía no existe.
   *
   * Precondiciones:
   * - El solicitante activo fue comprobado como propietario.
   * - El proyecto disponible está bloqueado.
   * - La cuenta destinataria existe.
   * - Todas las operaciones utilizan el mismo cliente transaccional.
   *
   * Devuelve:
   * - true: se agregó la relación.
   * - false: la relación ya existía.
   *
   * El servicio registrará una actividad solo cuando devuelva true.
   */
  async agregarColaborador(
    client: PoolClient,
    idProyecto: string,
    idUsuario: string,
  ): Promise<boolean> {
    const result = await client.query(
      `
      INSERT INTO obra.usuario_proyecto (
        id_usuario,
        id_proyecto
      )
      VALUES ($1::uuid, $2::uuid)
      ON CONFLICT (id_usuario, id_proyecto) DO NOTHING
    `,
      [idUsuario, idProyecto],
    );

    if (result.rowCount === 1) {
      return true;
    }

    if (result.rowCount === 0) {
      return false;
    }

    throw new Error(
      'La inserción del colaborador devolvió un resultado inesperado.',
    );
  }

}