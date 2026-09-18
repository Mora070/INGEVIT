import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';

import { DatabaseService } from '../../../database/database.service';
import { CorreoService } from '../../correos/correo.service';
import {
  RecuperacionCodigoRepository,
} from '../recuperacion-codigo.repository';
import {
  esCodigoRecuperacion,
  generarCodigoRecuperacion,
  getRecuperacionSecret,
} from '../utils/codigo-recuperacion';
import { PasswordService } from './password.service';

export const MENSAJE_RECUPERACION =
  'Si la cuenta permite recuperar su contraseña, recibirás un correo con las instrucciones.';

/**
 * Recuperación mediante correo y código de ocho dígitos.
 * No devuelve códigos ni inicia sesión automáticamente.
 */
@Injectable()
export class RecuperacionPasswordService {
  private readonly logger = new Logger(RecuperacionPasswordService.name);
  private readonly secreto = getRecuperacionSecret();

  constructor(
    private readonly database: DatabaseService,
    private readonly repository: RecuperacionCodigoRepository,
    private readonly passwords: PasswordService,
    private readonly correo: CorreoService,
  ) {}

  async solicitar(correo: string): Promise<{ message: string }> {
    const codigo = generarCodigoRecuperacion();

    const destinatario = await this.database.withTransaction(
      (client) =>
        this.repository.emitir(client, correo, codigo, this.secreto),
    );

    if (destinatario !== null) {
      try {
        await this.correo.enviar({
          destinatario,
          asunto: 'INGEVIT: código de recuperación',
          texto: [
            'Recibimos una solicitud para restablecer tu contraseña.',
            '',
            `Tu código es: ${codigo}`,
            '',
            'Es válido durante 15 minutos y permite hasta cinco intentos.',
            'Introduce el código junto con el correo de tu cuenta.',
            'Una nueva solicitud reemplaza el código anterior.',
            '',
            'Si no solicitaste este cambio, puedes ignorar este mensaje.',
          ].join('\n'),
        });
      } catch {
        // No registra el código, el correo ni el contenido del mensaje.
        this.logger.error(
          'No se pudo confirmar el envío de un correo de recuperación.',
        );
      }
    }

    return { message: MENSAJE_RECUPERACION };
  }

  /**
   * El DTO valida correo, código y contraseña.
   * Argon2 se ejecuta antes de adquirir bloqueos en PostgreSQL.
   */
  async restablecer(
    correo: string,
    codigo: string,
    passwordNueva: string,
  ): Promise<void> {
    if (!esCodigoRecuperacion(codigo)) {
      throw this.codigoInvalido();
    }

    const passwordHash = await this.passwords.generarHash(passwordNueva);

    const consumida = await this.database.withTransaction(
      (client) =>
        this.repository.consumir(
          client,
          correo,
          codigo,
          passwordHash,
          this.secreto,
        ),
    );

    /*
     * El error se lanza DESPUÉS de confirmar la transacción.
     * Así se conserva el incremento de intentos incorrectos.
     */
    if (!consumida) {
      throw this.codigoInvalido();
    }
  }

  private codigoInvalido(): BadRequestException {
    return new BadRequestException(
      'El código no es válido, ha expirado o alcanzó el límite de intentos.',
    );
  }
}