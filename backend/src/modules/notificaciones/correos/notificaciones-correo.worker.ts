import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';

import {
  NotificacionesCorreoService,
} from './notificaciones-correo.service';

import {
  getCorreoTrabajadorConfig,
} from './correo-trabajador.config';

import type {
  CorreoTrabajadorConfig,
} from './correo-trabajador.config';

/**
 * Programa el procesamiento periódico de notificaciones.
 *
 * Responsabilidades:
 * - Mantener como máximo un ciclo activo en este proceso.
 * - Limitar las notificaciones procesadas por ciclo.
 * - Esperar entre ciclos.
 * - Detener la programación durante el apagado.
 *
 * La coordinación entre procesos corresponde a las reservas
 * de PostgreSQL, no al temporizador de este trabajador.
 */
@Injectable()
export class NotificacionesCorreoWorker
  implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(
    NotificacionesCorreoWorker.name,
  );

  private configuracion: CorreoTrabajadorConfig | undefined;
  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private cicloEnCurso: Promise<void> | undefined;

  private iniciado = false;
  private deteniendo = false;

  constructor(
    private readonly servicio: NotificacionesCorreoService,
  ) { }

  /**
   * Arranca después de inicializar los módulos.
   * Valida la configuración incluso cuando está deshabilitado.
   */
  onApplicationBootstrap(): void {
    if (this.iniciado || this.deteniendo) {
      return;
    }

    this.configuracion = getCorreoTrabajadorConfig();
    this.iniciado = true;

    if (!this.configuracion.habilitado) {
      return;
    }

    this.programarSiguienteCiclo();
  }

  /**
   * El intervalo se mide desde el final del ciclo anterior.
   * Nunca programa otro temporizador mientras existe un ciclo activo.
   */
  private programarSiguienteCiclo(): void {
    const configuracion = this.configuracion;

    if (
      this.deteniendo ||
      !configuracion?.habilitado ||
      this.temporizador !== undefined ||
      this.cicloEnCurso !== undefined
    ) {
      return;
    }

    this.temporizador = setTimeout(() => {
      this.temporizador = undefined;

      if (this.deteniendo) {
        return;
      }

      /*
       * Diferimos el inicio a una microtarea para asignar cicloEnCurso
       * antes de ejecutar el servicio, incluso si este falla de inmediato.
       */
      this.cicloEnCurso = Promise.resolve()
        .then(() => this.ejecutarCiclo(configuracion))
        .catch(() => {
          // No imprimimos direcciones, contenido ni errores SMTP completos.
          this.logger.error(
            'El ciclo de correo terminó con un error. ' +
            'Las reservas pendientes requieren revisión.',
          );
        })
        .finally(() => {
          this.cicloEnCurso = undefined;
          this.programarSiguienteCiclo();
        });
    }, configuracion.intervaloMs);

    // El temporizador por sí solo no mantiene vivo el proceso.
    this.temporizador.unref();
  }

  private async ejecutarCiclo(
    configuracion: CorreoTrabajadorConfig,
  ): Promise<void> {

    if (this.deteniendo) {
      return;
    }

    const recuperadas = await this.servicio.recuperarReservasVencidas();

    if (recuperadas > 0) {
      this.logger.warn(
        `Se cerraron ${recuperadas} reservas de correo vencidas sin reenviar mensajes.`,
      );
    }
    for (
      let numero = 0;
      numero < configuracion.maxPorCiclo;
      numero += 1
    ) {
      if (this.deteniendo) {
        return;
      }

      const resultado = await this.servicio.procesarSiguiente();

      switch (resultado) {
        case 'SIN_PENDIENTES':
          return;

        case 'ENVIADA':
        case 'DESCARTADA':
          // Continúa con la siguiente notificación dentro del límite.
          break;

        case 'FALLIDA':
          // Finaliza el ciclo para no seguir enviando inmediatamente
          // cuando el transporte puede estar fallando.
          this.logger.warn(
            'Una notificación terminó sin confirmación de envío. ' +
            'Se detiene el ciclo actual.',
          );
          return;

        case 'RESERVA_PERDIDA':
          this.logger.warn(
            'No se pudo registrar el resultado con la reserva actual. ' +
            'Se detiene el ciclo sin repetir el envío.',
          );
          return;

        default:
          throw new Error(
            'El procesador de correo devolvió un resultado desconocido.',
          );
      }
    }
  }

  /**
   * Deja de tomar nuevas tareas y espera la operación en curso.
   *
   * Esta fase ocurre antes de OnApplicationShutdown, donde se cierran
   * el pool de PostgreSQL y el transporte de correo.
   *
   * No cancela un envío SMTP a mitad ni interpreta su interrupción
   * como una garantía de que el mensaje no fue recibido.
   */
  async beforeApplicationShutdown(): Promise<void> {
    this.deteniendo = true;

    if (this.temporizador !== undefined) {
      clearTimeout(this.temporizador);
      this.temporizador = undefined;
    }

    await this.cicloEnCurso;
  }
}