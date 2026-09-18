import {
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';

import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';

import {
  FotografiasDescargaService,
} from './fotografias-descarga.service';


/**
 * Entrega fotografías optimizadas después de comprobar el acceso.
 *
 * Esta ruta coincide con las URLs generadas durante la subida.
 * No expone el directorio de almacenamiento como contenido estático.
 */
@Controller('proyectos/:idProyecto/fotografias/archivos')
@UseGuards(AuthGuard)
export class FotografiasDescargaController {
  private readonly logger = new Logger(
    FotografiasDescargaController.name,
  );

  constructor(
    private readonly descargaService: FotografiasDescargaService,
  ) {}

  /**
   * Transfiere la versión optimizada como imagen WebP.
   *
   * Usamos @Res() porque este método controla la respuesta:
   * pipeline finaliza la transferencia o destruye los flujos
   * afectados si ocurre un error.
   */
  @Get(':nombreArchivo')
  async descargar(
    @Param('idProyecto', new ParseUUIDPipe())
    idProyecto: string,
    @Param('nombreArchivo')
    nombreArchivo: string,
    @Req() request: AuthRequest,
    @Res() response: Response,
  ): Promise<void> {
    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    /*
     * Los errores de autorización y apertura ocurren antes
     * de iniciar la respuesta y los gestiona NestJS.
     */
    const flujo = await this.descargaService.abrirOptimizada(
      idProyecto,
      usuario.id_usuario,
      nombreArchivo,
    );

    try {
      /*
       * El cliente pudo desconectarse mientras comprobábamos
       * permisos o abríamos el archivo.
       */
      if (response.destroyed) {
        return;
      }

      response.setHeader('Content-Type', 'image/webp');
      response.setHeader('Content-Disposition', 'inline');
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');

      try {
        await pipeline(flujo, response);
      } catch {
        /*
         * La transferencia puede haber comenzado: no intentamos
         * enviar una segunda respuesta JSON sobre una imagen parcial.
         *
         * pipeline destruye los flujos al fallar. Registramos
         * un mensaje sin rutas locales ni detalles del archivo.
         */
        this.logger.warn(
          'La transferencia de una fotografía no pudo completarse.',
        );
      }
    } finally {
      // También libera el archivo si la conexión ya estaba cerrada.
      flujo.destroy();
    }
  }
}