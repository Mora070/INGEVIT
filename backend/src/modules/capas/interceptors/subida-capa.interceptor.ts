import {
  BadRequestException,
  Logger,
  ServiceUnavailableException,
  mixin,
} from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
  Type,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { defer, lastValueFrom } from 'rxjs';

import {
  getSubidaCapaConfig,
} from '../config/subida-capa.config';
import type {
  SubidaCapaConfig,
} from '../config/subida-capa.config';
import {
  AlmacenamientoTemporalCapa,
} from '../utils/almacenamiento-temporal-capa';

/**
 * Construye el interceptor de recepción del GeoTIFF.
 *
 * La configuración pertenece al servidor, nunca al formulario.
 * Cada petición recibe un almacenamiento temporal independiente.
 *
 * Este interceptor administra archivos, no permisos ni validación geográfica.
 * La ruta deberá comprobar la autorización antes de recibir el archivo.
 */
export function crearInterceptorSubidaCapa(
  configuracion?: SubidaCapaConfig,
  raizTemporal?: string,
): Type<NestInterceptor> {
  class SubidaCapaInterceptor implements NestInterceptor {
    private readonly logger = new Logger('SubidaCapaInterceptor');

    intercept(context: ExecutionContext, next: CallHandler) {
      return defer(async () => {
        const config = configuracion ?? getSubidaCapaConfig();
        if (!config.habilitada) {
          throw new ServiceUnavailableException(
            'La subida de capas todavía no está habilitada.',
          );
        }

        const request = context.switchToHttp().getRequest<Request>();

        if (!request.is('multipart/form-data')) {
          throw new BadRequestException(
            'La capa debe enviarse mediante multipart/form-data.',
          );
        }

        const almacenamiento = new AlmacenamientoTemporalCapa(
          config.maxArchivoBytes,
          raizTemporal,
        );

        const InterceptorArchivo = FileInterceptor('archivo', {
          storage: almacenamiento,
          limits: {
            files: 1,
            fields: 2,
            // El almacenamiento también cuenta los bytes reales.
            fileSize: config.maxArchivoBytes + 1,
          },
        });

        const receptor = new InterceptorArchivo();

        const alInterrumpir = () => {
          void almacenamiento.cerrar().catch(() => {
            this.logger.error(
              'No se pudo limpiar una recepción de capa interrumpida.',
            );
          });
        };

        request.once('aborted', alInterrumpir);

        try {
          const resultado = await receptor.intercept(context, {
            handle: () => {
              if (request.aborted) {
                throw new BadRequestException(
                  'La recepción de la capa fue interrumpida.',
                );
              }

              if (!request.file) {
                throw new BadRequestException(
                  'El archivo GeoTIFF es obligatorio.',
                );
              }

              return next.handle();
            },
          });

          /*
           * Esperamos también los pipes y el controlador.
           * De esta forma el archivo continúa disponible mientras lo utilizan.
           * Esta ruta devolverá JSON, no una respuesta de streaming.
           */
          return await lastValueFrom(resultado);
        } finally {
          request.removeListener('aborted', alInterrumpir);
          await almacenamiento.cerrar();
        }
      });
    }
  }

  return mixin(SubidaCapaInterceptor);
}