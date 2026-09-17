import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';

import {
  RecuperacionColaRepository,
} from './recuperacion-cola.repository';
import {
  RecuperacionPasswordService,
} from './services/recuperacion-password.service';

/**
 * Procesa solicitudes de recuperación fuera de la petición HTTP.
 *
 * - Un único ciclo simultáneo por proceso.
 * - Reservas en PostgreSQL para coordinar varios procesos.
 * - Máximo cinco solicitudes por ciclo.
 * - Dos segundos de espera después de terminar cada ciclo.
 * - El apagado espera a que termine la operación en curso.
 */
@Injectable()
export class RecuperacionColaWorker
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger(RecuperacionColaWorker.name);

  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private cicloEnCurso: Promise<void> | undefined;
  private iniciado = false;
  private deteniendo = false;
  private habilitado = false;

  constructor(
    private readonly cola: RecuperacionColaRepository,
    private readonly recuperacion: RecuperacionPasswordService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.iniciado || this.deteniendo) return;

    const valor =
      process.env.RECUPERACION_TRABAJADOR_HABILITADO ?? 'false';

    if (valor !== 'true' && valor !== 'false') {
      throw new Error(
        'RECUPERACION_TRABAJADOR_HABILITADO debe ser true o false.',
      );
    }

    this.habilitado = valor === 'true';
    this.iniciado = true;
    this.programar();
  }

  private programar(): void {
    if (
      !this.habilitado ||
      this.deteniendo ||
      this.temporizador !== undefined ||
      this.cicloEnCurso !== undefined
    ) {
      return;
    }

    this.temporizador = setTimeout(() => {
      this.temporizador = undefined;

      if (this.deteniendo) return;

      /*
       * La microtarea permite asignar cicloEnCurso antes de ejecutar
       * cualquier dependencia, incluso si falla inmediatamente.
       */
      this.cicloEnCurso = Promise.resolve()
        .then(() => this.procesarCiclo())
        .catch(() => {
          // Nunca incluye correos, códigos ni detalles de consultas.
          this.logger.error(
            'No se pudo completar el ciclo de recuperación de contraseña.',
          );
        })
        .finally(() => {
          this.cicloEnCurso = undefined;
          this.programar();
        });
    }, 2000);

    this.temporizador.unref();
  }

  private async procesarCiclo(): Promise<void> {
    if (this.deteniendo) return;

    await this.cola.limpiarVencidas();

    for (let numero = 0; numero < 5; numero += 1) {
      if (this.deteniendo) return;

      const solicitud = await this.cola.reservar();

      if (solicitud === null) return;

      /*
       * Reutiliza la comprobación de cuenta local activa,
       * el límite de emisiones y el envío del código.
       *
       * Si ocurre un error inesperado, no liberamos la reserva:
       * podría haberse enviado el mensaje. La limpieza posterior
       * retirará la tarea sin repetir automáticamente el envío.
       */
      await this.recuperacion.solicitar(solicitud.correo);

      await this.cola.completar(solicitud.id_solicitud);
    }
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.deteniendo = true;

    if (this.temporizador !== undefined) {
      clearTimeout(this.temporizador);
      this.temporizador = undefined;
    }

    await this.cicloEnCurso;
  }
}