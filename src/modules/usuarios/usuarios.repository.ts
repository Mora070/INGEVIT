import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { EstadoUsuario, UsuarioRow } from './types/usuario.types';
import type { CrearUsuarioTradicionalInput } from './types/crear-usuario.types';

/**
 * Selección explícita de las columnas del usuario.
 *
 * Evitamos SELECT * para que agregar columnas a la tabla no cambie
 * automáticamente los datos recuperados por este repositorio.
 *
 * Esta consulta incluye datos de autenticación:
 * sus resultados son internos y no deben enviarse directamente
 * desde un controlador.
 */
const SELECT_USUARIO = `
  SELECT
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
    google_sub
  FROM obra.usuarios
`;

/**
 * Acceso a los datos de usuarios.
 *
 * Responsabilidades:
 * - Ejecutar consultas parametrizadas.
 * - Devolver el usuario encontrado o null.
 * - Propagar los errores de PostgreSQL.
 *
 * No convierte errores de conexión en "usuario inexistente".
 * No comprueba contraseñas ni autoriza el acceso al sistema.
 */
@Injectable()
export class UsuariosRepository {
  constructor(
    private readonly database: DatabaseService,
  ) { }

  /**
   * Busca por el identificador interno del usuario.
   *
   * El identificador debe validarse como UUID en la capa de entrada
   * cuando proceda de una petición HTTP.
   */
  async findById(idUsuario: string): Promise<UsuarioRow | null> {
    const result = await this.database.query<UsuarioRow>(
      `${SELECT_USUARIO}
       WHERE id_usuario = $1::uuid`,
      [idUsuario],
    );

    return result.rows[0] ?? null;
  }

  /**
   * Busca por correo sin distinguir mayúsculas.
   *
   * Elimina espacios exteriores de la entrada y utiliza la misma
   * comparación que el índice único sobre lower(correo).
   *
   * No modifica el correo almacenado.
   */
  async findByCorreo(correo: string): Promise<UsuarioRow | null> {
    const result = await this.database.query<UsuarioRow>(
      `${SELECT_USUARIO}
       WHERE lower(correo) = lower($1::text)`,
      [correo.trim()],
    );

    return result.rows[0] ?? null;
  }

  /**
   * Busca por la identidad estable proporcionada por Google.
   *
   * El módulo de autenticación debe verificar el token antes
   * de utilizar su claim sub para identificar al usuario.
   */
  async findByGoogleSub(googleSub: string): Promise<UsuarioRow | null> {
    const result = await this.database.query<UsuarioRow>(
      `${SELECT_USUARIO}
       WHERE google_sub = $1`,
      [googleSub],
    );

    return result.rows[0] ?? null;
  }

  /**
   * Inserta una cuenta tradicional con un hash previamente generado.
   *
   * Devuelve:
   * - El registro creado cuando la inserción tiene éxito.
   * - null cuando el correo ya existe, sin distinguir mayúsculas.
   *
   * Otros errores de PostgreSQL se propagan.
   *
   * El resultado contiene datos internos sensibles y no debe
   * devolverse directamente desde un controlador.
   */
  async crearTradicional(
    datos: CrearUsuarioTradicionalInput,
  ): Promise<UsuarioRow | null> {
    const result = await this.database.query<UsuarioRow>(
      `
      INSERT INTO obra.usuarios (
        correo,
        password_hash,
        nombre,
        apellidos,
        telefono,
        ubicacion,
        rol,
        estado,
        google_sub
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'USUARIO',
        'ACTIVO',
        NULL
      )
      ON CONFLICT (lower(correo)) DO NOTHING
      RETURNING
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
        google_sub
    `,
      [
        datos.correo.trim(),
        datos.passwordHash,
        datos.nombre,
        datos.apellidos,
        datos.telefono,
        datos.ubicacion,
      ],
    );

    return result.rows[0] ?? null;
  }

  /**
 * Actualiza exclusivamente el estado de una cuenta.
 *
 * Devuelve:
 * - El registro actualizado cuando el usuario existe.
 * - null cuando el identificador no corresponde a ningún usuario.
 *
 * Repetir el mismo estado es válido y devuelve el registro.
 * No elimina usuarios ni modifica proyectos o colaboradores.
 *
 * La autorización del administrador se aplica antes de invocar
 * esta operación desde la ruta correspondiente.
 *
 * El resultado contiene datos internos: debe pasar por el mapper
 * antes de enviarse al cliente.
 */
async actualizarEstado(
  idUsuario: string,
  estado: EstadoUsuario,
): Promise<UsuarioRow | null> {
  const result = await this.database.query<UsuarioRow>(
    `
      UPDATE obra.usuarios
      SET estado = $2::obra.estado_usuario
      WHERE id_usuario = $1::uuid
      RETURNING
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
        google_sub
    `,
    [idUsuario, estado],
  );

  return result.rows[0] ?? null;
}

}