import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { UsuariosRepository } from './usuarios.repository';
import { toUsuarioResponse } from './mappers/usuario.mapper';
import type { CrearUsuarioTradicionalInput } from './types/crear-usuario.types';
import type {
  EstadoUsuario,
  UsuarioResponse,
  UsuarioRow,
} from './types/usuario.types';

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
    private readonly usuariosRepository: UsuariosRepository,
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
    const usuario = await this.usuariosRepository.findById(
      idUsuarioAutenticado,
    );

    if (!usuario || usuario.estado !== 'ACTIVO') {
      throw new UnauthorizedException(
        'La sesión no es válida o la cuenta no está activa.',
      );
    }

    return toUsuarioResponse(usuario);
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
    return this.usuariosRepository.findByCorreo(correo);
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
  const usuario = await this.usuariosRepository.crearTradicional(
    datos,
  );

  if (usuario === null) {
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
  const usuario = await this.usuariosRepository.actualizarEstado(
    idUsuario,
    estado,
  );

  if (usuario === null) {
    throw new NotFoundException(
      'El usuario no existe.',
    );
  }

  return toUsuarioResponse(usuario);
}

}