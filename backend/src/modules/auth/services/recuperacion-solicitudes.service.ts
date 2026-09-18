import { Injectable } from '@nestjs/common';

import {
  RecuperacionColaRepository,
} from '../recuperacion-cola.repository';

import {
  MENSAJE_RECUPERACION,
} from './recuperacion-password.service';

/**
 * Atiende la solicitud pública sin consultar usuarios ni esperar SMTP.
 * El trabajador comprobará la cuenta y los límites posteriormente.
 */
@Injectable()
export class RecuperacionSolicitudesService {
  constructor(
    private readonly cola: RecuperacionColaRepository,
  ) {}

  async solicitar(correo: string): Promise<{ message: string }> {
    await this.cola.encolar(correo);

    return { message: MENSAJE_RECUPERACION };
  }
}