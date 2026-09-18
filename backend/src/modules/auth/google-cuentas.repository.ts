import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../database/database.service';
import type { UsuarioRow } from '../usuarios/types/usuario.types';
import type { IdentidadGoogle } from './services/google-identidad.service';

/**
 * Columnas internas necesarias para emitir la sesión y mapear el perfil.
 * El resultado nunca debe devolverse directamente desde un controlador.
 */
const COLUMNAS_USUARIO = `
  id_usuario,
  nombre,
  apellidos,
  foto_perfil_url,
  correo,
  telefono,
  password_hash,
  fecha_creacion,
  ubicacion,
  rol,
  estado,
  google_sub,
  version_sesion
`;

/**
 * Resuelve identidades Google sin vincular cuentas por coincidencia
 * de correo y sin sobrescribir los datos de un perfil existente.
 */
@Injectable()
export class GoogleCuentasRepository {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Devuelve una cuenta existente o crea una cuenta exclusiva de Google.
   *
   * null significa que la creación encontró una cuenta incompatible,
   * por ejemplo, otra cuenta que ya utiliza ese correo.
   *
   * Devuelve también cuentas inactivas para que el servicio rechace
   * expresamente el inicio de sesión.
   */
  async obtenerOCrear(
    identidad: IdentidadGoogle,
  ): Promise<UsuarioRow | null> {
    return this.database.withTransaction(async (client) => {
      const existente = await this.buscarPorSub(client, identidad.sub);

      if (existente !== null) {
        return existente;
      }

      /*
       * Los índices únicos resuelven registros simultáneos.
       * No capturamos errores SQL de duplicidad: ON CONFLICT evita
       * abortar la transacción ante esa situación esperada.
       *
       * La cuenta nueva no recibe contraseña ni avatar externo.
       */
      const creada = await client.query<UsuarioRow>(
        `
          INSERT INTO obra.usuarios (
            correo,
            nombre,
            apellidos,
            google_sub,
            password_hash,
            rol,
            estado
          )
          VALUES ($1, $2, $3, $4, NULL, 'USUARIO', 'ACTIVO')
          ON CONFLICT DO NOTHING
          RETURNING ${COLUMNAS_USUARIO}
        `,
        [
          identidad.correo,
          identidad.nombre,
          identidad.apellidos,
          identidad.sub,
        ],
      );

      if (creada.rows[0]) {
        return creada.rows[0];
      }

      /*
       * Otra solicitud pudo crear este mismo sub mientras esperábamos.
       * Solo recuperamos por sub; nunca asociamos por correo.
       */
      return this.buscarPorSub(client, identidad.sub);
    });
  }

  private async buscarPorSub(
    client: PoolClient,
    sub: string,
  ): Promise<UsuarioRow | null> {
    const resultado = await client.query<UsuarioRow>(
      `
        SELECT ${COLUMNAS_USUARIO}
        FROM obra.usuarios
        WHERE google_sub = $1
        FOR UPDATE
      `,
      [sub],
    );

    return resultado.rows[0] ?? null;
  }
}