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
  PanoramicasDescargaService,
} from './panoramicas-descarga.service';

/** Entrega el original después de comprobar la sesión y el acceso. */
@Controller('proyectos/:idProyecto/panoramicas/archivos')
@UseGuards(AuthGuard)
export class PanoramicasDescargaController {
  private readonly logger = new Logger(
    PanoramicasDescargaController.name,
  );

  constructor(
    private readonly descarga: PanoramicasDescargaService,
  ) {}

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

    // Los errores de acceso y apertura ocurren antes de enviar contenido.
    const { flujo, mimeType } = await this.descarga.abrir(
      idProyecto,
      usuario.id_usuario,
      nombreArchivo,
    );

    try {
      if (response.destroyed) return;

      response.setHeader('Content-Type', mimeType);
      response.setHeader('Content-Disposition', 'inline');
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');

      try {
        await pipeline(flujo, response);
      } catch {
        // No intentamos enviar JSON sobre una transferencia parcial.
        this.logger.warn(
          'La transferencia de una panorámica no pudo completarse.',
        );
      }
    } finally {
      flujo.destroy();
    }
  }
}