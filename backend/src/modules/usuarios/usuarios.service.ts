import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import {
  UsuariosRepository,
  type UsuariosColaboradoresPaginadosRow,
} from './usuarios.repository';

import {
  toUsuarioResponse,
} from './mappers/usuario.mapper';

import type {
  CrearUsuarioTradicionalInput,
} from './types/crear-usuario.types';

import type {
  EstadoUsuario,
  UsuarioResponse,
  UsuarioRow,
} from './types/usuario.types';

import type {
  ActualizarPerfilInput,
} from './types/actualizar-perfil.types';

import type {
  UsuarioColaboradorResponse,
} from './types/usuario-colaborador.types';

import type {
  ListarUsuariosColaboradoresQueryDto,
} from './dto/listar-usuarios-colaboradores-query.dto';

export interface UsuariosColaboradoresPaginadosResponse {
  usuarios: UsuarioColaboradorResponse[];
  pagina: number;
  limite: number;
  total: number;
  total_paginas: number;
}

/**
 * Expone los casos de uso del módulo de usuarios.
 *
 * El repositorio se encarga del SQL.
 * Este servicio aplica las reglas correspondientes al caso de uso.
 * El mapper construye las respuestas que pueden salir hacia el cliente.
 */
@Injectable()
export class UsuariosService {
  constructor(
    private readonly usuariosRepository:
      UsuariosRepository,
  ) {}

  /**
   * Obtiene el perfil de la identidad previamente autenticada.
   *
   * El identificador debe proceder del mecanismo de autenticación,
   * nunca de un campo libre enviado por el cliente.
   *
   * Consulta el estado actual para detectar una inactivación
   * posterior al inicio de sesión.
   */
  async obtenerMiPerfil(
    idUsuarioAutenticado: string,
  ): Promise<UsuarioResponse> {
    const usuario =
      await this.usuariosRepository.findById(
        idUsuarioAutenticado,
      );

    if (
      !usuario ||
      usuario.estado !== 'ACTIVO'
    ) {
      throw new UnauthorizedException(
        'La sesión no es válida o la cuenta no está activa.',
      );
    }

    return toUsuarioResponse(
      usuario,
    );
  }

  /**
   * Lista usuarios activos que pueden mostrarse
   * como candidatos a colaborador.
   *
   * El usuario autenticado no aparece en los resultados.
   * El repositorio devuelve únicamente campos públicos mínimos.
   */
  async listarDisponiblesParaColaborador(
    idUsuarioAutenticado: string,
    consulta: ListarUsuariosColaboradoresQueryDto,
  ): Promise<UsuariosColaboradoresPaginadosResponse> {
    const {
      pagina,
      limite,
      correo,
    } = consulta;

    const resultado:
      UsuariosColaboradoresPaginadosRow =
        await this.usuariosRepository
          .findColaboradoresDisponiblesPaginados(
            idUsuarioAutenticado,
            pagina,
            limite,
            correo,
          );

    return {
      usuarios:
        resultado.usuarios.map(
          (usuario) => ({
            id_usuario:
              usuario.id_usuario,

            nombre:
              usuario.nombre,

            apellidos:
              usuario.apellidos,

            correo:
              usuario.correo,

            foto_perfil_url:
              usuario.foto_perfil_url,
          }),
        ),

      pagina,

      limite,

      total:
        resultado.total,

      total_paginas:
        Math.ceil(
          resultado.total /
            limite,
        ),
    };
  }

  /**
   * Busca los datos internos necesarios para autenticar una cuenta.
   *
   * IMPORTANTE:
   * El resultado contiene password_hash y google_sub.
   * Solo debe utilizarse dentro del backend; no debe devolverse
   * directamente desde un controlador ni registrarse en logs.
   *
   * Incluye cuentas inactivas y cuentas exclusivas de Google.
   * AuthService decidirá si pueden autenticarse por contraseña.
   *
   * Devuelve null únicamente cuando el correo no existe.
   * Los errores del repositorio se propagan sin ocultarlos.
   */
  async buscarPorCorreoParaAutenticacion(
    correo: string,
  ): Promise<UsuarioRow | null> {
    return this.usuariosRepository
      .findByCorreo(
        correo,
      );
  }

  /**
   * Crea una cuenta tradicional utilizando un hash ya generado.
   *
   * PostgreSQL resuelve la unicidad del correo durante la inserción.
   * Si el repositorio devuelve null, respondemos con un conflicto.
   *
   * El resultado es interno: contiene el hash y debe pasar por
   * el mapper antes de enviarse al cliente.
   */
  async crearTradicional(
    datos: CrearUsuarioTradicionalInput,
  ): Promise<UsuarioRow> {
    const usuario =
      await this.usuariosRepository
        .crearTradicional(
          datos,
        );

    if (
      usuario === null
    ) {
      throw new ConflictException(
        'No se puede registrar una cuenta con ese correo.',
      );
    }

    return usuario;
  }

  /**
   * Actualiza el estado de una cuenta y devuelve su perfil seguro.
   *
   * Precondición:
   * La ruta debe exigir una identidad autenticada con rol ADMINISTRADOR.
   * Este método no autentica por sí mismo a quien solicita el cambio.
   *
   * No modifica el estado ni la eliminación lógica de los proyectos.
   * La disponibilidad se determinará utilizando el estado del propietario.
   *
   * Repetir el estado actual es válido.
   */
  async actualizarEstado(
    idUsuario: string,
    estado: EstadoUsuario,
  ): Promise<UsuarioResponse> {
    const usuario =
      await this.usuariosRepository
        .actualizarEstado(
          idUsuario,
          estado,
        );

    if (
      usuario === null
    ) {
      throw new NotFoundException(
        'El usuario no existe.',
      );
    }

    return toUsuarioResponse(
      usuario,
    );
  }

  /**
   * Actualiza los datos personales del usuario autenticado.
   *
   * El identificador debe proceder de la sesión validada.
   * Nunca debe tomarse del cuerpo de la petición.
   *
   * El DTO valida y normaliza los valores antes de llegar aquí.
   * Este método exige al menos un campo y selecciona explícitamente
   * los datos que puede recibir el repositorio.
   */
  async actualizarMiPerfil(
    idUsuarioAutenticado: string,
    datos: ActualizarPerfilInput,
  ): Promise<UsuarioResponse> {
    const cambios:
      ActualizarPerfilInput = {
        nombre:
          datos.nombre,

        apellidos:
          datos.apellidos,

        telefono:
          datos.telefono,

        ubicacion:
          datos.ubicacion,
      };

    const tieneCambios =
      Object.values(
        cambios,
      ).some(
        (valor) =>
          valor !== undefined,
      );

    if (!tieneCambios) {
      throw new BadRequestException(
        'Debes enviar al menos un campo del perfil para actualizar.',
      );
    }

    const usuario =
      await this.usuariosRepository
        .actualizarPerfil(
          idUsuarioAutenticado,
          cambios,
        );

    if (
      !usuario ||
      usuario.estado !==
        'ACTIVO'
    ) {
      throw new UnauthorizedException(
        'La sesión no es válida o la cuenta no está activa.',
      );
    }

    return toUsuarioResponse(
      usuario,
    );
  }

  /**
   * Consulta interna para operaciones de autenticación.
   *
   * El resultado contiene información sensible.
   * No debe devolverse desde un controlador ni registrarse en logs.
   */
  async buscarPorIdParaAutenticacion(
    idUsuario: string,
  ): Promise<UsuarioRow | null> {
    return this.usuariosRepository
      .findById(
        idUsuario,
      );
  }

  /**
   * Delega la actualización condicional del hash.
   *
   * Ambos hashes deben proceder del backend.
   */
  async actualizarPasswordSiCoincide(
    idUsuario: string,
    hashActual: string,
    hashNuevo: string,
  ): Promise<boolean> {
    return this.usuariosRepository
      .actualizarPasswordSiCoincide(
        idUsuario,
        hashActual,
        hashNuevo,
      );
  }

  /**
   * Obtiene el perfil únicamente si la sesión conserva su vigencia.
   *
   * Consulta estado y versión en la misma fila.
   * La versión procede de un token previamente verificado.
   *
   * No expone version_sesion ni información de autenticación.
   */
  async obtenerPerfilDeSesion(
    idUsuario: string,
    versionSesion: number,
  ): Promise<UsuarioResponse> {
    if (
      !Number.isInteger(
        versionSesion,
      ) ||
      versionSesion < 0 ||
      versionSesion >
        2_147_483_647
    ) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    const usuario =
      await this.usuariosRepository
        .findById(
          idUsuario,
        );

    if (
      !usuario ||
      usuario.estado !==
        'ACTIVO' ||
      usuario.version_sesion !==
        versionSesion
    ) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return toUsuarioResponse(
      usuario,
    );
  }
}