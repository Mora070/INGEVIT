import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';

import { DatabaseService } from '../../database/database.service';
import {
  ResultadoTransaccionDesconocidoError,
} from '../../database/errors/resultado-transaccion-desconocido.error';
import {
  AlmacenamientoService,
} from '../almacenamiento/almacenamiento.service';
import { ProyectosRepository } from '../proyectos/proyectos.repository';
import { ActividadesRepository } from '../actividades/actividades.repository';

import { CapasRepository } from './capas.repository';
import { mapearCapa } from './mappers/capa.mapper';
import type { CapaResponse } from './types/capa.types';
import type { SubirCapaDto } from './dto/subir-capa.dto';
import type { MetadatosGeoTiff } from './utils/inspeccionar-geotiff';

export interface OriginalCapaInspeccionado {
  rutaTemporal: string;
  nombreOriginal: string;
  tamanoBytes: number;
  metadatos: MetadatosGeoTiff;
}

/**
 * Conserva el original y registra la capa junto con su actividad.
 *
 * Requisitos previos:
 * - El guard comprobó el acceso antes de recibir el archivo.
 * - El coordinador inspeccionó el GeoTIFF.
 * - El temporal permanece disponible durante esta operación.
 *
 * No mantiene una transacción abierta mientras copia el archivo.
 * Comprueba nuevamente los permisos al comenzar la transacción.
 */
@Injectable()
export class CapasPersistenciaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly proyectos: ProyectosRepository,
    private readonly capas: CapasRepository,
    private readonly actividades: ActividadesRepository,
  ) {}

  async guardarYRegistrar(
    idProyecto: string,
    idUsuario: string,
    datos: SubirCapaDto,
    archivo: OriginalCapaInspeccionado,
  ): Promise<CapaResponse> {
    const clave = `capas/${randomUUID()}.tif`;
    const entrada = createReadStream(archivo.rutaTemporal);

    /*
     * Copia los bytes originales mediante un flujo.
     * El nombre del cliente nunca se utiliza como ruta.
     *
     * Si guardar falla, no eliminamos la clave: podría existir previamente.
     * El almacenamiento limpia sus propias escrituras parciales.
     */
    try {
      await this.almacenamiento.guardar(clave, entrada);
    } finally {
      entrada.destroy();
    }

    try {
      return await this.database.withTransaction(async (client) => {
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

        const capa = await this.capas.crearPendiente(client, {
          idProyecto,
          idUsuarioSubida: idUsuario,
          nombre: datos.nombre,
          descripcion: datos.descripcion,
          nombreArchivoOriginal: archivo.nombreOriginal,
          originalKey: clave,
          tamanoOriginalBytes: archivo.tamanoBytes,
          crsOriginal: archivo.metadatos.crsOriginal,
          bbox: archivo.metadatos.bbox,
        });

        await this.actividades.crear(client, {
          idProyecto,
          idActor: idUsuario,
          tipoAccion: 'CAPA_CREADA',
          mensaje: `Capa ${capa.id_capa} registrada para procesamiento.`,
        });

        // Un error del mapeador también debe revertir la transacción.
        return mapearCapa(capa);
      });
    } catch (errorRegistro: unknown) {
      /*
       * Si COMMIT o ROLLBACK tienen un resultado incierto, el archivo
       * podría estar referenciado. Lo conservamos para su conciliación.
       */
      if (
        errorRegistro instanceof ResultadoTransaccionDesconocidoError
      ) {
        throw errorRegistro;
      }

      try {
        await this.almacenamiento.eliminar(clave);
      } catch (errorLimpieza: unknown) {
        throw new AggregateError(
          [errorRegistro, errorLimpieza],
          'Falló el registro de la capa y no pudo eliminarse su archivo.',
        );
      }

      throw errorRegistro;
    }
  }
}