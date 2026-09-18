import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { GoogleCuentasRepository } from '../google-cuentas.repository';
import { GoogleIdentidadService } from './google-identidad.service';
import { TokenService } from './token.service';
import { toUsuarioResponse } from '../../usuarios/mappers/usuario.mapper';

import type {
  ResultadoAutenticacion,
} from '../types/resultado-autenticacion.types';

/**
 * Coordina la identidad verificada, la cuenta local y la sesión.
 *
 * No acepta identidades proporcionadas directamente por el cliente.
 * La credencial debe pasar siempre por GoogleIdentidadService.
 */
@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly identidades: GoogleIdentidadService,
    private readonly cuentas: GoogleCuentasRepository,
    private readonly tokens: TokenService,
  ) {}

  async iniciarSesion(
    credential: string,
  ): Promise<ResultadoAutenticacion> {
    // La verificación externa termina antes de abrir la transacción.
    const identidad = await this.identidades.verificar(credential);

    const usuario = await this.cuentas.obtenerOCrear(identidad);

    if (usuario === null) {
      throw new ConflictException(
        'No se puede utilizar Google con esta cuenta. Inicia sesión con el método con el que te registraste.',
      );
    }

    if (usuario.estado !== 'ACTIVO') {
      throw new UnauthorizedException(
        'La cuenta no está disponible para iniciar sesión.',
      );
    }

    /*
     * Utiliza la misma versión de sesión del login tradicional.
     * La inactivación o un cambio de versión posteriores serán
     * detectados por AuthGuard al utilizar la sesión.
     */
    const tokenAcceso = await this.tokens.emitirTokenConVersion(
      usuario.id_usuario,
      usuario.version_sesion,
    );

    return {
      tokenAcceso,
      usuario: toUsuarioResponse(usuario),
    };
  }
}