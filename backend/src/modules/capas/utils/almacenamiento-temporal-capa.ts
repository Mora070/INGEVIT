import type { Request } from 'express';
import type { StorageEngine } from 'multer';
import type { Readable } from 'node:stream';

import { recibirTemporalCapa } from './recibir-temporal-capa';

/**
 * Adaptador de Multer exclusivo de una petición y un archivo.
 *
 * Entrega path y size cuando termina la escritura.
 * Conserva el temporal hasta cerrar() o hasta que Multer solicite eliminarlo.
 *
 * No debe registrarse como un servicio compartido entre peticiones.
 * Quien lo utilice debe esperar cerrar() en un bloque finally.
 */
export class AlmacenamientoTemporalCapa implements StorageEngine {
  private iniciado = false;
  private cerrado = false;
  private entregado = false;
  private flujo?: Readable;
  private tarea?: Promise<void>;

  private falloPosterior: unknown;
  private huboFalloPosterior = false;

  private liberar!: () => void;
  private readonly liberacion = new Promise<void>((resolve) => {
    this.liberar = resolve;
  });

  constructor(
    private readonly maxArchivoBytes: number,
    private readonly raizTemporal?: string,
  ) {}

  _handleFile(
    _request: Request,
    archivo: Express.Multer.File,
    callback: (
      error?: unknown,
      info?: Partial<Express.Multer.File>,
    ) => void,
  ): void {
    if (this.iniciado || this.cerrado) {
      callback(
        new Error('La recepción temporal no admite otro archivo.'),
      );
      return;
    }

    this.iniciado = true;
    this.flujo = archivo.stream;

    /*
     * La promesa tiene un manejador de errores desde su creación.
     * Los errores de recepción se entregan a Multer.
     * Los posteriores a la entrega se propagan mediante cerrar().
     */
    this.tarea = recibirTemporalCapa(
      archivo.stream,
      this.maxArchivoBytes,
      async ({ ruta, tamanoBytes }) => {
        this.entregado = true;

        callback(null, {
          path: ruta,
          size: tamanoBytes,
        });

        // Mantiene el archivo hasta que termine su consumidor.
        await this.liberacion;
      },
      this.raizTemporal,
    ).catch((error: unknown) => {
      if (!this.entregado) {
        callback(error);
        return;
      }

      this.huboFalloPosterior = true;
      this.falloPosterior = error;
    });
  }

  _removeFile(
    _request: Request,
    _archivo: Express.Multer.File,
    callback: (error: Error | null) => void,
  ): void {
    void this.cerrar().then(
      () => callback(null),
      (error: unknown) => {
        callback(
          error instanceof Error
            ? error
            : new Error('No se pudo limpiar el temporal de la capa.'),
        );
      },
    );
  }

  /**
   * Admite llamadas repetidas.
   * Espera la finalización de la escritura y la eliminación del temporal.
   */
  async cerrar(): Promise<void> {
    this.cerrado = true;
    this.liberar();

    if (!this.entregado) {
      // Interrumpe una recepción pendiente sin introducir un error sin oyente.
      this.flujo?.destroy();
    }

    await this.tarea;

    if (this.huboFalloPosterior) {
      throw this.falloPosterior;
    }
  }
}