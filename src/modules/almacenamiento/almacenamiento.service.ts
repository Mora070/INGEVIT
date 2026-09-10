import type { Readable } from 'node:stream';

/**
 * Contrato interno para almacenar y recuperar archivos.
 *
 * Las implementaciones concretas pueden utilizar disco local o Amazon S3.
 * No conoce usuarios, proyectos ni permisos de negocio.
 *
 * El servicio que coordina la operación debe comprobar la autorización
 * antes de llamar al almacenamiento.
 *
 * Esta clase abstracta también servirá como identificador de inyección
 * de dependencias en Nest.
 */
export abstract class AlmacenamientoService {
  /**
   * Guarda un archivo nuevo bajo una clave generada por el backend.
   *
   * Ejemplo de clave: fotografias/<uuid>.jpg
   *
   * La clave no debe proceder directamente del nombre original enviado
   * por el usuario. La implementación debe validar su formato e impedir
   * que permita acceder fuera de la ubicación configurada.
   *
   * Debe rechazar una clave ya existente, sin sobrescribir su archivo.
   * Solo resuelve cuando finaliza la escritura.
   */
  abstract guardar(
    clave: string,
    contenido: Readable,
  ): Promise<void>;

  /**
   * Abre un archivo para su lectura.
   *
   * La implementación debe rechazar la operación si el archivo no existe.
   * El consumidor debe gestionar los errores del flujo y cerrarlo
   * cuando termine o se interrumpa la transferencia.
   */
  abstract abrirLectura(
    clave: string,
  ): Promise<Readable>;

  /**
   * Elimina definitivamente el archivo identificado por la clave.
   *
   * Si ya no existe, termina correctamente para permitir reintentos.
   * Los demás errores deben propagarse.
   */
  abstract eliminar(
    clave: string,
  ): Promise<void>;
}