import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

import {
  AlmacenamientoService,
} from './almacenamiento.service';

import {
  ArchivosPendientesRepository,
} from './archivos-pendientes.repository';

import {
  validarClaveAlmacenamiento,
} from './utils/validar-clave-almacenamiento';

/**
 * Procesa tareas persistentes de eliminación.
 *
 * Actualmente solo procesa claves de fotografías, porque son
 * las únicas cuya comprobación de referencias está implementada.
 *
 * No contiene temporizadores ni inicia trabajos automáticamente.
 */
@Injectable()
export class ArchivosPendientesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly pendientes: ArchivosPendientesRepository,
    private readonly almacenamiento: AlmacenamientoService,
  ) { }

  /**
 * Procesa una tarea sin programar automáticamente su reintento.
 *
 * Conserva el comportamiento utilizado por las pruebas existentes.
 */
  async procesarSiguiente(): Promise<boolean> {
    return this.procesarUnaTarea();
  }

  /**
   * Procesa una tarea y, si falla, intenta aplazarla.
   *
   * La demora es una configuración técnica del trabajador.
   * Se valida antes de iniciar cualquier operación.
   *
   * Un aplazamiento correcto no oculta el fallo: se vuelve a lanzar
   * el error original para que el trabajador pueda registrarlo.
   */
  async procesarSiguienteConReintento(
    demoraSegundos: number,
  ): Promise<boolean> {
    if (
      !Number.isSafeInteger(demoraSegundos) ||
      demoraSegundos <= 0
    ) {
      throw new Error(
        'La demora del reintento debe ser un número entero positivo de segundos.',
      );
    }

    let claveSeleccionada: string | undefined;

    try {
      return await this.procesarUnaTarea((clave) => {
        claveSeleccionada = clave;
      });
    } catch (errorProcesamiento: unknown) {
      /*
       * Si falló la conexión o la selección, todavía no sabemos
       * qué tarea aplazar. Propagamos el error sin otra escritura.
       */
      if (claveSeleccionada === undefined) {
        throw errorProcesamiento;
      }

      const clave = claveSeleccionada;

      try {
        /*
         * La transacción anterior ya terminó o descartó su conexión.
         * El aplazamiento necesita una transacción independiente.
         *
         * Si la tarea ya desapareció, aplazar devuelve false.
         * No la recreamos: pudo completarse en otro intento.
         */
        await this.database.withTransaction((client) =>
          this.pendientes.aplazar(
            client,
            clave,
            demoraSegundos,
          ),
        );
      } catch (errorAplazamiento: unknown) {
        /*
         * Conservamos ambos errores y su orden:
         * 1. El fallo que interrumpió el procesamiento.
         * 2. El fallo al intentar programar el reintento.
         */
        throw new AggregateError(
          [errorProcesamiento, errorAplazamiento],
          'Falló el procesamiento del archivo y no pudo confirmarse su aplazamiento.',
        );
      }

      throw errorProcesamiento;
    }
  }

  /**
   * Procesa como máximo una tarea.
   *
   * Devuelve:
   * - true: el archivo se eliminó y la tarea quedó retirada.
   * - false: no había tareas disponibles.
   *
   * Si ocurre un error, la transacción se revierte y la tarea
   * permanece pendiente.
   */
  private async procesarUnaTarea(
    alSeleccionar?: (clave: string) => void,
  ): Promise<boolean> {
    return this.database.withTransaction(async (client) => {
      const tarea = await this.pendientes.bloquearSiguiente(client);

      if (tarea === null) {
        return false;
      }

      // Permite identificar qué tarea falló sin modificar el error original.
      alSeleccionar?.(tarea.s3_key);

      const clave = validarClaveAlmacenamiento(tarea.s3_key);

      /*
       * Cada categoría utiliza su comprobación de referencias.
       * Las categorías todavía no implementadas siguen rechazándose.
       */
      if (clave.startsWith('fotografias/')) {
        const referenciado =
          await this.pendientes.estaReferenciadoEnFotografias(
            client,
            clave,
          );

        if (referenciado) {
          throw new Error(
            'El archivo pendiente continúa referenciado por una fotografía.',
          );
        }
      } else if (clave.startsWith('planos/')) {
        const referenciado =
          await this.pendientes.estaReferenciadoEnPlanos(
            client,
            clave,
          );

        if (referenciado) {
          throw new Error(
            'El archivo pendiente continúa referenciado por un plano.',
          );
        }
      } else {
        throw new Error(
          'La categoría del archivo pendiente todavía no puede procesarse.',
        );
      }



      /*
       * Esperamos el resultado del almacenamiento antes de retirar
       * la tarea. La implementación admite archivos ya inexistentes.
       *
       * El bloqueo de PostgreSQL permanece durante esta operación.
       */
      await this.almacenamiento.eliminar(clave);

      await this.pendientes.completar(client, clave);

      return true;
    });
  }
}