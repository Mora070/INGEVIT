import {
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { isEmail } from 'class-validator';

import { getGoogleClientId } from '../google.config';
import { VERIFICADOR_GOOGLE } from '../google-verificador';
import type { VerificadorGoogle } from '../google-verificador';

export interface IdentidadGoogle {
  /** Identificador estable de Google. Es la identidad principal. */
  sub: string;
  correo: string;
  nombre: string | null;
  apellidos: string | null;
}

/**
 * Convierte una credencial verificada en identidad interna.
 *
 * No consulta PostgreSQL, crea cuentas ni emite cookies.
 * Nunca registra la credencial ni la incluye en los errores.
 */
@Injectable()
export class GoogleIdentidadService {
  private readonly clientId = getGoogleClientId();

  constructor(
    @Inject(VERIFICADOR_GOOGLE)
    private readonly verificador: VerificadorGoogle,
  ) {}

  async verificar(credential: string): Promise<IdentidadGoogle> {
    if (
      typeof credential !== 'string' ||
      credential.length === 0 ||
      credential.length > 16384
    ) {
      throw this.identidadInvalida();
    }

    const payload = await this.verificador.verificar(
      credential,
      this.clientId,
    );

    /*
     * Esta comprobación complementa la verificación criptográfica.
     * email_verified no autoriza a vincular una cuenta local existente.
     */
    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0 ||
      payload.sub.length > 255 ||
      payload.email_verified !== true ||
      typeof payload.email !== 'string' ||
      payload.email !== payload.email.trim() ||
      payload.email.length > 254 ||
      !isEmail(payload.email)
    ) {
      throw this.identidadInvalida();
    }

    return {
      sub: payload.sub,
      correo: payload.email,
      nombre: this.nombreOpcional(payload.given_name, 100),
      apellidos: this.nombreOpcional(payload.family_name, 150),
    };
  }

  /**
   * Los nombres son información de presentación, no de autorización.
   * Si no cumplen los límites del perfil, se dejan pendientes de completar.
   */
  private nombreOpcional(
    valor: unknown,
    maximo: number,
  ): string | null {
    if (typeof valor !== 'string') return null;

    const texto = valor.trim();

    if (
      texto.length === 0 ||
      texto.length > maximo ||
      texto.includes('\0')
    ) {
      return null;
    }

    return texto;
  }

  private identidadInvalida(): UnauthorizedException {
    return new UnauthorizedException(
      'No se pudo validar la identidad de Google.',
    );
  }
}