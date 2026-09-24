import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../database/database.service';
import {
  ResultadoTransaccionDesconocidoError,
} from '../../database/errors/resultado-transaccion-desconocido.error';
import { ProyectosRepository } from '../proyectos/proyectos.repository';
import { ActividadesRepository } from '../actividades/actividades.repository';

import {
  CapasProcesamientoRepository,
} from './capas-procesamiento.repository';
import {
  CapasProcesamientoArchivosService,
} from './capas-procesamiento-archivos.service';
import { conVigenciaCapa } from './utils/vigencia-capa';
import { mapearCapa } from './mappers/capa.mapper';
import type { CapaResponse } from './types/capa.types';

/**
 * Coordina un intento completo.
 *
 * 1. Reserva la capa en una transacción corta.
 * 2. Procesa los archivos fuera de la transacción.
 * 3. Confirma la publicación y el historial juntos.
 *
 * No programa reintentos ni inicia trabajos automáticamente.
 */
@Injectable()
export class CapasProcesamientoService {
  constructor(
    private readonly database: DatabaseService,
    private readonly proyectos: ProyectosRepository,
    private readonly procesamiento: CapasProcesamientoRepository,
    private readonly archivos: CapasProcesamientoArchivosService,
    private readonly actividades: ActividadesRepository,
  ) {}

  async procesar(
    idProyecto: string,
    idCapa: string,
    idUsuario: string,
  ): Promise<CapaResponse> {
    /*
     * Si esta transacción resulta incierta, no iniciamos GDAL:
     * primero deberá conciliarse el intento reservado.
     */
    const intento = await this.database.withTransaction(async (client) => {
      await this.comprobarPropietario(client, idProyecto, idUsuario);

      const capa = await this.procesamiento.iniciar(
        client,
        idProyecto,
        idCapa,
      );

      if (!capa) {
        throw new ConflictException(
          'La capa no está disponible para iniciar el procesamiento.',
        );
      }

      if (!capa.procesamiento_token) {
        throw new Error('El intento de procesamiento no tiene identificador.');
      }

      return {
        capa,
        token: capa.procesamiento_token,
      };
    });

    try {
      return await conVigenciaCapa(
        () => this.database.withTransaction(async client => {
          await client.query("SET LOCAL lock_timeout = '2s'");
          await client.query("SET LOCAL statement_timeout = '5s'");
          return this.procesamiento.renovar(client, idProyecto, idCapa, intento.token);
        }),
        async comprobarVigencia => this.archivos.procesar(
        intento.capa,
        async (publicacion) => this.database.withTransaction(
          async (client) => {
            comprobarVigencia();
            await this.comprobarPropietario(
              client,
              idProyecto,
              idUsuario,
            );

            const capa = await this.procesamiento.finalizar(
              client,
              idProyecto,
              idCapa,
              intento.token,
              publicacion,
            );

            if (!capa) {
              throw new ConflictException(
                'El intento de procesamiento ya no está vigente.',
              );
            }

            await this.actividades.crear(client, {
              idProyecto,
              idActor: idUsuario,
              tipoAccion: 'CAPA_PROCESADA',
              mensaje: `Capa ${idCapa} procesada y disponible en el mapa.`,
            });

            return mapearCapa(capa);
          },
        ),
        ),
      );
    } catch (error: unknown) {
      if (error instanceof ResultadoTransaccionDesconocidoError) {
        // No compensar archivos ni alterar el estado de un resultado incierto.
        throw error;
      }

      try {
        /*
         * Cierre técnico del intento, incluso si se perdió el permiso.
         * Solo puede modificar la fila que aún conserve nuestro token.
         * No publica archivos ni concede acceso a información del proyecto.
         */
        await this.database.withTransaction((client) =>
          this.procesamiento.marcarError(
            client,
            idProyecto,
            idCapa,
            intento.token,
          ),
        );
      } catch (errorEstado: unknown) {
        throw new AggregateError(
          [error, errorEstado],
          'Falló el procesamiento y no pudo registrarse su estado final.',
        );
      }

      throw error;
    }
  }

  private async comprobarPropietario(
    client: PoolClient,
    idProyecto: string,
    idUsuario: string,
  ): Promise<void> {
    const activo = await this.proyectos.bloquearPropietarioActivo(
      client,
      idUsuario,
    );

    if (!activo) {
      throw new UnauthorizedException(
        'La sesión no es válida o la cuenta no está activa.',
      );
    }

    const proyecto =
      await this.proyectos.bloquearEditablePorPropietario(
        client,
        idProyecto,
        idUsuario,
      );

    if (!proyecto) {
      throw new NotFoundException(
        'El proyecto no está disponible para gestionar capas.',
      );
    }
  }
}

