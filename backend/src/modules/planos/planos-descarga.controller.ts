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

import { PlanosDescargaService } from './planos-descarga.service';

/**
 * Entrega el PDF después de comprobar la sesión y el acceso al proyecto.
 *
 * Coincide con la URL generada durante la subida.
 * El directorio de almacenamiento no se publica como contenido estático.
 */
@Controller('proyectos/:idProyecto/planos/archivos')
@UseGuards(AuthGuard)
export class PlanosDescargaController {
  private readonly logger = new Logger(PlanosDescargaController.name);

  constructor(
    private readonly descarga: PlanosDescargaService,
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

    /*
     * Los errores de autorización y apertura ocurren antes
     * de iniciar la transferencia y los gestiona NestJS.
     */
    const flujo = await this.descarga.abrir(
      idProyecto,
      usuario.id_usuario,
      nombreArchivo,
    );

    try {
      // El solicitante pudo desconectarse durante la apertura.
      if (response.destroyed) {
        return;
      }

      response.setHeader('Content-Type', 'application/pdf');
      response.setHeader(
        'Content-Disposition',
        'inline; filename="plano.pdf"',
      );
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');

      try {
        await pipeline(flujo, response);
      } catch {
        /*
         * pipeline destruye los flujos cuando falla.
         * No enviamos JSON después de comenzar una respuesta PDF.
         */
        this.logger.warn(
          'La transferencia de un plano no pudo completarse.',
        );
      }
    } finally {
      // También libera el recurso si el cliente ya estaba desconectado.
      flujo.destroy();
    }
  }
}