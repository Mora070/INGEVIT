import {
  Injectable,
  OnModuleInit,
} from '@nestjs/common';

import type { Readable } from 'node:stream';

import {
  AlmacenamientoService,
} from './almacenamiento.service';

import {
  getAlmacenamientoLocalConfig,
} from './config/almacenamiento.config';

import {
  prepararDirectoriosAlmacenamiento,
} from './utils/preparar-directorios-almacenamiento';

import {
  guardarArchivoLocal,
} from './utils/guardar-archivo-local';

import {
  abrirArchivoLocal,
} from './utils/abrir-archivo-local';

import {
  eliminarArchivoLocal,
} from './utils/eliminar-archivo-local';

/**
 * Implementación del almacenamiento sobre el disco local.
 *
 * Prepara la raíz y las categorías durante el arranque de Nest.
 * Las operaciones delegan en las funciones de archivos ya probadas.
 *
 * No conoce usuarios ni proyectos y no modifica PostgreSQL.
 * La autorización corresponde al servicio que coordine cada operación.
 */
@Injectable()
export class AlmacenamientoLocalService
  extends AlmacenamientoService
  implements OnModuleInit
{
  private directorioRaiz: string | null = null;

  /**
   * Nest espera esta inicialización antes de completar el arranque.
   *
   * Si la configuración o las carpetas no son válidas, el error se
   * propaga y el almacenamiento no queda marcado como disponible.
   */
  async onModuleInit(): Promise<void> {
    this.directorioRaiz = null;

    const configuracion = getAlmacenamientoLocalConfig();

    const raizPreparada = await prepararDirectoriosAlmacenamiento(
      configuracion.directorioRaiz,
    );

    this.directorioRaiz = raizPreparada;
  }

  /**
   * Guarda un archivo nuevo sin sobrescribir una clave existente.
   */
  async guardar(
    clave: string,
    contenido: Readable,
  ): Promise<void> {
    await guardarArchivoLocal(
      this.obtenerRaizInicializada(),
      clave,
      contenido,
    );
  }

  /**
   * Abre el archivo para lectura.
   * El consumidor debe cerrar el flujo si cancela la transferencia.
   */
  async abrirLectura(clave: string): Promise<Readable> {
    return abrirArchivoLocal(
      this.obtenerRaizInicializada(),
      clave,
    );
  }

  /**
   * Elimina el archivo; admite reintentos cuando ya no existe.
   */
  async eliminar(clave: string): Promise<void> {
    await eliminarArchivoLocal(
      this.obtenerRaizInicializada(),
      clave,
    );
  }

  /**
   * Evita ejecutar operaciones antes de una inicialización correcta.
   */
  private obtenerRaizInicializada(): string {
    if (this.directorioRaiz === null) {
      throw new Error(
        'El almacenamiento local no está inicializado.',
      );
    }

    return this.directorioRaiz;
  }
}