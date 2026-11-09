import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';

import { Upload } from '@aws-sdk/lib-storage';

import { Injectable } from '@nestjs/common';

import { Readable } from 'node:stream';

import {
  AlmacenamientoService,
} from './almacenamiento.service';

import {
  getAlmacenamientoS3Config,
} from './config/almacenamiento.config';

import {
  validarClaveAlmacenamiento,
} from './utils/validar-clave-almacenamiento';

/**
 * Almacenamiento privado en Amazon S3.
 *
 * Los archivos no se hacen públicos: el backend controla la autorización
 * y entrega las descargas mediante sus rutas autenticadas.
 */
@Injectable()
export class AlmacenamientoS3Service
  extends AlmacenamientoService
{
  private readonly cliente: S3Client;

  private readonly bucket: string;

  constructor() {
    super();

    const configuracion = getAlmacenamientoS3Config();

    this.bucket = configuracion.bucket;

    this.cliente = new S3Client({
      region: configuracion.region,
      credentials: {
        accessKeyId: configuracion.accessKeyId,
        secretAccessKey: configuracion.secretAccessKey,
      },
    });
  }

  async guardar(
    clave: string,
    contenido: Readable,
  ): Promise<void> {
    const claveValidada = validarClaveAlmacenamiento(clave);

    await this.verificarQueNoExiste(claveValidada);

    const carga = new Upload({
      client: this.cliente,
      params: {
        Bucket: this.bucket,
        Key: claveValidada,
        Body: contenido,
      },
      queueSize: 1,
      partSize: 8 * 1024 * 1024,
      leavePartsOnError: false,
    });

    await carga.done();
  }

  async abrirLectura(clave: string): Promise<Readable> {
    const claveValidada = validarClaveAlmacenamiento(clave);

    const respuesta = await this.cliente.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: claveValidada,
      }),
    );

    if (!(respuesta.Body instanceof Readable)) {
      throw new Error(
        'S3 no devolvió un flujo de lectura válido.',
      );
    }

    return respuesta.Body;
  }

  async eliminar(clave: string): Promise<void> {
    const claveValidada = validarClaveAlmacenamiento(clave);

    await this.cliente.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: claveValidada,
      }),
    );
  }

  private async verificarQueNoExiste(
    clave: string,
  ): Promise<void> {
    try {
      await this.cliente.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: clave,
        }),
      );
    } catch (error) {
      if (this.esNoEncontrado(error)) {
        return;
      }

      throw error;
    }

    throw new Error(
      'Ya existe un archivo con la misma clave de almacenamiento.',
    );
  }

  private esNoEncontrado(error: unknown): boolean {
    return (
      error instanceof S3ServiceException
      && error.$metadata.httpStatusCode === 404
    );
  }
}