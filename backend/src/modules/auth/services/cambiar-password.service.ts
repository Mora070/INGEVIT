import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { UsuariosService } from '../../usuarios/usuarios.service';
import { PasswordService } from './password.service';
import type { CambiarPasswordDto } from '../dto/cambiar-password.dto';

/**
 * Cambia la contraseña local de una cuenta autenticada.
 *
 * El controlador debe validar el DTO y proporcionar la identidad
 * de la sesión. No se aceptan identificadores desde el cuerpo HTTP.
 *
 * No devuelve contraseñas, hashes ni datos de autenticación.
 * No realiza reintentos automáticos.
 */
@Injectable()
export class CambiarPasswordService {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly passwords: PasswordService,
  ) {}

  async cambiar(
    idUsuarioAutenticado: string,
    datos: CambiarPasswordDto,
  ): Promise<void> {
    const usuario = await this.usuarios.buscarPorIdParaAutenticacion(
      idUsuarioAutenticado,
    );

    if (!usuario || usuario.estado !== 'ACTIVO') {
      throw new UnauthorizedException(
        'La sesión no es válida o la cuenta no está activa.',
      );
    }

    const hashActual = usuario.password_hash;

    if (hashActual === null) {
      throw new BadRequestException(
        'Esta cuenta no tiene una contraseña local para cambiar.',
      );
    }

    const coincide = await this.passwords.verificar(
      datos.password_actual,
      hashActual,
    );

    if (!coincide) {
      throw new UnauthorizedException(
        'La contraseña actual no es correcta.',
      );
    }

    // La comparación se realiza después de verificar la contraseña actual.
    // No recortamos espacios ni normalizamos los textos.
    if (datos.password_actual === datos.password_nueva) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente de la actual.',
      );
    }

    const hashNuevo = await this.passwords.generarHash(
      datos.password_nueva,
    );

    const actualizada = await this.usuarios.actualizarPasswordSiCoincide(
      idUsuarioAutenticado,
      hashActual,
      hashNuevo,
    );

    if (!actualizada) {
      throw new ConflictException(
        'La cuenta cambió durante la operación. Inicia sesión nuevamente.',
      );
    }
  }
}