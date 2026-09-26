import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

/**
 * Comprueba y mantiene el acceso durante una transacción de escritura.
 *
 * No concede acceso adicional por el rol global de administrador.
 * No abre ni confirma transacciones.
 *
 * fotografias-acceso.repository.ts
 */
@Injectable()
export class ProyectoAccesoRepository {
  /**
   * Comprueba que el solicitante pueda operar sobre el proyecto.
   *
   * Permite:
   * - propietario;
   * - colaboradores actuales.
   *
   * Devuelve false si el proyecto no está disponible para él.
   * Los errores de PostgreSQL se propagan.
   *
   * Debe utilizarse con la transacción READ COMMITTED actual del backend.
   */
  async bloquearDisponible(
    client: PoolClient,
    idProyecto: string,
    idUsuario: string,
  ): Promise<boolean> {
    // Primero identificamos al propietario; después volveremos a comprobarlo.
    const proyectoInicial = await client.query<{
      id_propietario: string;
    }>(
      `
        SELECT id_propietario
        FROM obra.proyectos
        WHERE id_proyecto = $1::uuid
      `,
      [idProyecto],
    );

    const proyecto =
      proyectoInicial.rows[0];

    if (!proyecto) {
      return false;
    }

    const idPropietario =
      proyecto.id_propietario;

    /*
     * Bloqueamos los usuarios antes del proyecto.
     * FOR SHARE impide su inactivación hasta terminar la transacción.
     * El orden por identificador mantiene un orden consistente.
     */
    const usuarios = await client.query<{
      id_usuario: string;
    }>(
      `
        SELECT id_usuario
        FROM obra.usuarios
        WHERE id_usuario IN ($1::uuid, $2::uuid)
          AND estado = 'ACTIVO'
        ORDER BY id_usuario
        FOR SHARE
      `,
      [
        idPropietario,
        idUsuario,
      ],
    );

    const usuariosEsperados =
      idPropietario === idUsuario
        ? 1
        : 2;

    if (
      usuarios.rows.length !==
      usuariosEsperados
    ) {
      return false;
    }

    /*
     * Verificamos nuevamente el propietario y la eliminación lógica.
     *
     * El bloqueo entra en conflicto con la modificación o eliminación
     * del proyecto y con el FOR UPDATE que utiliza la gestión
     * de colaboradores.
     */
    const proyectoBloqueado =
      await client.query<{
        id_proyecto: string;
      }>(
        `
          SELECT id_proyecto
          FROM obra.proyectos
          WHERE id_proyecto = $1::uuid
            AND id_propietario = $2::uuid
            AND activo = true
          FOR SHARE
        `,
        [
          idProyecto,
          idPropietario,
        ],
      );

    if (
      proyectoBloqueado.rows.length ===
      0
    ) {
      return false;
    }

    if (
      idUsuario ===
      idPropietario
    ) {
      return true;
    }

    /*
     * Consultamos la colaboración DESPUÉS de obtener el bloqueo.
     *
     * En READ COMMITTED esta sentencia ve los cambios confirmados
     * mientras esperábamos. No reutilizamos una comprobación de
     * pertenencia anterior al bloqueo del proyecto.
     */
    const colaboracion =
      await client.query<{
        existe: boolean;
      }>(
        `
          SELECT EXISTS (
            SELECT 1
            FROM obra.usuario_proyecto
            WHERE id_proyecto = $1::uuid
              AND id_usuario = $2::uuid
          ) AS existe
        `,
        [
          idProyecto,
          idUsuario,
        ],
      );

    return (
      colaboracion.rows[0]
        ?.existe === true
    );
  }

  /**
   * Comprueba que el solicitante sea el propietario activo
   * de un proyecto activo.
   *
   * A diferencia de bloquearDisponible(), este método NO concede
   * acceso a colaboradores.
   *
   * El usuario propietario se mantiene con FOR SHARE para impedir
   * su inactivación durante la operación.
   *
   * El proyecto se bloquea con FOR UPDATE porque las operaciones
   * exclusivas del propietario pueden modificar estado relacionado
   * con el proyecto y deben serializarse entre sí.
   *
   * Devuelve false cuando:
   * - el proyecto no existe;
   * - está eliminado lógicamente;
   * - el usuario no es su propietario;
   * - el propietario no está activo.
   */
  async bloquearPropietario(
    client: PoolClient,
    idProyecto: string,
    idUsuario: string,
  ): Promise<boolean> {
    /*
     * Primero bloqueamos al usuario.
     *
     * Conservamos el mismo orden general de bloqueo:
     * usuarios antes que proyecto.
     */
    const usuario =
      await client.query<{
        id_usuario: string;
      }>(
        `
          SELECT id_usuario
          FROM obra.usuarios
          WHERE id_usuario = $1::uuid
            AND estado = 'ACTIVO'
          FOR SHARE
        `,
        [
          idUsuario,
        ],
      );

    if (
      usuario.rows.length !==
      1
    ) {
      return false;
    }

    /*
     * FOR UPDATE deja el proyecto reservado durante toda
     * la transacción para operaciones exclusivas del propietario.
     */
    const proyecto =
      await client.query<{
        id_proyecto: string;
      }>(
        `
          SELECT id_proyecto
          FROM obra.proyectos
          WHERE id_proyecto = $1::uuid
            AND id_propietario = $2::uuid
            AND activo = true
          FOR UPDATE
        `,
        [
          idProyecto,
          idUsuario,
        ],
      );

    return (
      proyecto.rows.length ===
      1
    );
  }
}