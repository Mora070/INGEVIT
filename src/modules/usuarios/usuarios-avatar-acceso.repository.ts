import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

/**
 * Selecciona la referencia del avatar y comprueba su visibilidad
 * en una misma consulta.
 *
 * Ser administrador no concede acceso adicional.
 * No devuelve claves de usuarios inactivos.
 */
@Injectable()
export class UsuariosAvatarAccesoRepository {
  constructor(private readonly database: DatabaseService) {}

  async buscarDisponible(
    idUsuario: string,
    idSolicitante: string,
  ): Promise<string | null> {
    const resultado = await this.database.query<{
      foto_perfil_key: string;
    }>(
      `
        SELECT titular.foto_perfil_key
        FROM obra.usuarios AS titular
        WHERE titular.id_usuario = $1::uuid
          AND titular.estado = 'ACTIVO'
          AND titular.foto_perfil_key IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM obra.usuarios AS solicitante
            WHERE solicitante.id_usuario = $2::uuid
              AND solicitante.estado = 'ACTIVO'
          )
          AND (
            titular.id_usuario = $2::uuid
            OR EXISTS (
              SELECT 1
              FROM obra.proyectos AS p
              INNER JOIN obra.usuarios AS propietario
                ON propietario.id_usuario = p.id_propietario
              WHERE p.activo = TRUE
                AND propietario.estado = 'ACTIVO'
                AND (
                  p.id_propietario = titular.id_usuario
                  OR EXISTS (
                    SELECT 1
                    FROM obra.usuario_proyecto AS participante
                    WHERE participante.id_proyecto = p.id_proyecto
                      AND participante.id_usuario = titular.id_usuario
                  )
                )
                AND (
                  p.id_propietario = $2::uuid
                  OR EXISTS (
                    SELECT 1
                    FROM obra.usuario_proyecto AS participante
                    WHERE participante.id_proyecto = p.id_proyecto
                      AND participante.id_usuario = $2::uuid
                  )
                )
            )
          )
      `,
      [idUsuario, idSolicitante],
    );

    return resultado.rows[0]?.foto_perfil_key ?? null;
  }
}