import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { EstadoUsuario, UsuarioRow } from './types/usuario.types';
import type { CrearUsuarioTradicionalInput } from './types/crear-usuario.types';

import type {
  ActualizarPerfilInput,
} from './types/actualizar-perfil.types';

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
    google_sub,
    version_sesion
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
        google_sub,
        version_sesion
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
        google_sub,
        version_sesion
    `,
      [idUsuario, estado],
    );

    return result.rows[0] ?? null;
  }

  /**
   * Actualiza los campos personales de una cuenta activa.
   *
   * Los indicadores booleanos distinguen un campo omitido de null.
   * No usamos COALESCE porque impediría borrar un dato explícitamente.
   *
   * La condición de cuenta activa se aplica en el propio UPDATE.
   * El servicio debe proporcionar la identidad autenticada y rechazar
   * una actualización sin campos.
   *
   * Devuelve null si la cuenta no existe o está inactiva.
   * El resultado es interno y debe pasar por el mapper del usuario.
   */
  async actualizarPerfil(
    idUsuario: string,
    datos: ActualizarPerfilInput,
  ): Promise<UsuarioRow | null> {
    const resultado = await this.database.query<UsuarioRow>(
      `
        UPDATE obra.usuarios
        SET
          nombre = CASE
            WHEN $2::boolean THEN $3::text
            ELSE nombre
          END,
          apellidos = CASE
            WHEN $4::boolean THEN $5::text
            ELSE apellidos
          END,
          telefono = CASE
            WHEN $6::boolean THEN $7::text
            ELSE telefono
          END,
          ubicacion = CASE
            WHEN $8::boolean THEN $9::text
            ELSE ubicacion
          END
        WHERE id_usuario = $1::uuid
          AND estado = 'ACTIVO'
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
          google_sub,
          version_sesion
      `,
      [
        idUsuario,
        datos.nombre !== undefined,
        datos.nombre ?? null,
        datos.apellidos !== undefined,
        datos.apellidos ?? null,
        datos.telefono !== undefined,
        datos.telefono ?? null,
        datos.ubicacion !== undefined,
        datos.ubicacion ?? null,
      ],
    );

    return resultado.rows[0] ?? null;
  }

  /**
 * Sustituye el hash únicamente si coincide con el verificado.
 *
 * El servicio debe comprobar la contraseña actual y generar
 * el nuevo hash antes de llamar a este método.
 *
 * Ambos hashes proceden del backend, nunca de campos HTTP.
 *
 * Devuelve false si:
 * - La cuenta no existe o está inactiva.
 * - Otra operación ya cambió la contraseña.
 * - La cuenta no tiene contraseña local.
 *
 * No devuelve datos del usuario ni realiza reintentos.
 * 
 * * Incrementa la versión de sesión en la misma sentencia.
* Si no coincide el hash o la cuenta está inactiva, no modifica
* ni la contraseña ni la versión.

 */
  async actualizarPasswordSiCoincide(
    idUsuario: string,
    hashActual: string,
    hashNuevo: string,
  ): Promise<boolean> {
    const resultado = await this.database.query(
      `
        UPDATE obra.usuarios
        SET password_hash = $3::text, version_sesion = version_sesion + 1
        WHERE id_usuario = $1::uuid
          AND estado = 'ACTIVO'
          AND password_hash = $2::text
      `,
      [idUsuario, hashActual, hashNuevo],
    );

    return resultado.rowCount === 1;
  }

}