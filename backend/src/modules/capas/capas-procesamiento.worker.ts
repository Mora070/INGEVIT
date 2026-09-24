import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';

import { CapasRecuperacionService } from './capas-recuperacion.service';
import { CapasColaService } from './capas-cola.service';
import {
  getCapasTrabajadorConfig,
} from './config/capas-trabajador.config';
import { getGdalConfig } from './config/gdal.config';
import { getTeselasConfig } from './config/teselas.config';
import { validarMotorTeselas } from './utils/generar-teselas';
import { CapasLimpiezaService } from './capas-limpieza.service';

/**
 * Ejecuta una capa por ciclo y espera antes del siguiente.
 *
 * El siguiente temporizador se programa únicamente cuando termina
 * el ciclo anterior. Así no se solapan procesos GDAL en esta instancia.
 *
 * Durante el apagado deja de tomar tareas y espera la operación activa
 * antes de que DatabaseService cierre el pool.
 */
@Injectable()
export class CapasProcesamientoWorker
  implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(CapasProcesamientoWorker.name);

  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private cicloEnCurso: Promise<void> | undefined;
  private intervaloMs = 5000;
  private habilitado = false;
  private iniciado = false;
  private deteniendo = false;

  constructor(
    private readonly cola: CapasColaService,
    private readonly recuperacion: CapasRecuperacionService,
    private readonly limpieza: CapasLimpiezaService,
  ) { }

  onApplicationBootstrap(): void {
    if (this.iniciado || this.deteniendo) {
      return;
    }

    const configuracion = getCapasTrabajadorConfig();

    if (configuracion.habilitado) {
      // Rechaza una configuración incompleta antes de tomar trabajos.
      getGdalConfig();
      getTeselasConfig();
      validarMotorTeselas();
    }

    this.intervaloMs = configuracion.intervaloMs;
    this.habilitado = configuracion.habilitado;
    this.iniciado = true;

    this.programar();
  }

  private programar(): void {
    if (
      !this.habilitado
      || this.deteniendo
      || this.temporizador !== undefined
      || this.cicloEnCurso !== undefined
    ) {
      return;
    }

    this.temporizador = setTimeout(() => {
      this.temporizador = undefined;

      if (this.deteniendo) {
        return;
      }

      this.cicloEnCurso = this.ejecutarCiclo();
    }, this.intervaloMs);

    this.temporizador.unref();
  }

  private async ejecutarCiclo(): Promise<void> {
    try {
      await this.recuperacion.recuperar();
      if (!this.deteniendo) {
        try {
          await this.limpieza.procesarSiguiente();
        } catch {
          // Una limpieza fallida no debe bloquear todas las subidas pendientes.
          this.logger.warn(
            'No se completó una limpieza de capa. La tarea permanece pendiente.',
          );
        }
      }
      if (!this.deteniendo) await this.cola.procesarSiguiente();
    } catch {
      /*
       * El coordinador registra ERROR cuando puede confirmar el fallo.
       * No exponemos rutas, consultas ni detalles internos en el log.
       * Tampoco reiniciamos aquí intentos de resultado incierto.
       */
      this.logger.warn(
        'No se completó el ciclo de capas. Se consultarán los pendientes en el próximo ciclo.',
      );
    } finally {
      this.cicloEnCurso = undefined;
      this.programar();
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

