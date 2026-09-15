import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';

import {
  ArchivosPendientesService,
} from './archivos-pendientes.service';

import {
  getArchivosPendientesConfig,
} from './config/archivos-pendientes.config';

import type {
  ArchivosPendientesConfig,
} from './config/archivos-pendientes.config';

/**
 * Programa el procesamiento de archivos pendientes.
 *
 * - Ejecuta como máximo un ciclo simultáneo en este proceso.
 * - Limita la cantidad de tareas por ciclo.
 * - Espera entre ciclos, incluso después de un fallo.
 * - Detiene la programación durante el apagado.
 *
 * Los bloqueos de PostgreSQL coordinan trabajadores de procesos distintos.
 */
@Injectable()
export class ArchivosPendientesWorker
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger(
    ArchivosPendientesWorker.name,
  );

  private configuracion: ArchivosPendientesConfig | undefined;
  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private cicloEnCurso: Promise<void> | undefined;
  private deteniendo = false;
  private iniciado = false;

  constructor(
    private readonly servicio: ArchivosPendientesService,
  ) {}

  /**
   * Se ejecuta cuando los módulos ya terminaron su inicialización.
   * La configuración se valida aunque el trabajador esté desactivado.
   */
  onApplicationBootstrap(): void {
    if (this.iniciado) {
      return;
    }

    this.configuracion = getArchivosPendientesConfig();
    this.iniciado = true;

    if (!this.configuracion.habilitado) {
      return;
    }

    this.programarSiguienteCiclo();
  }

  /**
   * Programa un único ciclo.
   * El intervalo comienza después de terminar el ciclo anterior.
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

      this.cicloEnCurso = this.ejecutarYReprogramar(configuracion);
    }, configuracion.intervaloMs);

    // El temporizador por sí solo no mantiene vivo el proceso.
    this.temporizador.unref();
  }

  /**
   * Contiene los errores para que el temporizador no genere
   * promesas rechazadas sin manejar.
   */
  private async ejecutarYReprogramar(
    configuracion: ArchivosPendientesConfig,
  ): Promise<void> {
    try {
      for (
        let numero = 0;
        numero < configuracion.maxTareasPorCiclo;
        numero += 1
      ) {
        if (this.deteniendo) {
          break;
        }

        const procesada =
          await this.servicio.procesarSiguienteConReintento(
            configuracion.demoraReintentoSegundos,
          );

        if (!procesada) {
          break;
        }
      }
    } catch {
      /*
       * Finalizamos este ciclo ante un fallo.
       * Si el servicio consiguió aplazar la tarea, el siguiente
       * ciclo podrá seleccionar otras tareas disponibles.
       *
       * También esperamos cuando falla PostgreSQL o el aplazamiento,
       * evitando una repetición inmediata del mismo error.
       */
      this.logger.warn(
        'El ciclo de eliminación encontró un error. Se volverá a intentar en el próximo ciclo.',
      );
    } finally {
      this.cicloEnCurso = undefined;
      this.programarSiguienteCiclo();
    }
  }

  /**
   * Nest ejecuta esta fase antes de OnApplicationShutdown,
   * donde DatabaseService cierra el pool.
   *
   * No interrumpimos una operación de almacenamiento a mitad:
   * esperamos su resultado y la finalización de su transacción.
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