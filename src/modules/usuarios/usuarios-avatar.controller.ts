import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';

import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';

import {
  UsuariosAvatarOperacionesService,
} from './usuarios-avatar-operaciones.service';
import type {
  AvatarResponse,
} from './usuarios-avatar-operaciones.service';
import {
  MAX_BYTES_AVATAR_ENTRADA,
} from './config/avatar.config';

/**
 * Expone los avatares sin publicar la carpeta de almacenamiento.
 *
 * AuthGuard se ejecuta antes del interceptor de archivos.
 * El OriginGuard global protege las operaciones de modificación.
 */
@Controller('usuarios')
@UseGuards(AuthGuard)
export class UsuariosAvatarController {
  private readonly logger = new Logger(UsuariosAvatarController.name);

  constructor(
    private readonly operaciones: UsuariosAvatarOperacionesService,
  ) {}

  /**
   * Recibe un único campo de archivo llamado "archivo".
   * No acepta campos de texto, claves internas ni URLs del cliente.
   *
   * El límite se aplica mientras se recibe el contenido.
   * El formato real se comprueba posteriormente al optimizar.
   */
  @Post('me/avatar')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_BYTES_AVATAR_ENTRADA,
        files: 1,
        fields: 0,
        parts: 2,
      },
    }),
  )
  async subir(
    @Req() request: AuthRequest,
    @UploadedFile() archivo: { buffer: Buffer } | undefined,
  ): Promise<AvatarResponse> {
    const idUsuario = this.obtenerIdentidad(request);

    if (!archivo || !Buffer.isBuffer(archivo.buffer)) {
      throw new BadRequestException(
        'Debes proporcionar una fotografía en el campo archivo.',
      );
    }

    return this.operaciones.subir(idUsuario, archivo.buffer);
  }

  @Delete('me/avatar')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async retirar(
    @Req() request: AuthRequest,
  ): Promise<AvatarResponse> {
    return this.operaciones.retirar(this.obtenerIdentidad(request));
  }

  /**
   * Devuelve el avatar actual solamente después de comprobar permisos.
   * no-store evita reutilizar una respuesta sin volver a autorizarla.
   */
  @Get(':idUsuario/avatar')
  async descargar(
    @Param('idUsuario', new ParseUUIDPipe()) idUsuario: string,
    @Req() request: AuthRequest,
    @Res() response: Response,
  ): Promise<void> {
    const flujo = await this.operaciones.abrir(
      idUsuario,
      this.obtenerIdentidad(request),
    );

    try {
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
        // La respuesta puede haber comenzado; no enviamos otro JSON.
        this.logger.warn(
          'La transferencia del avatar no pudo completarse.',
        );
      }
    } finally {
      flujo.destroy();
    }
  }

  private obtenerIdentidad(request: AuthRequest): string {
    if (!request.usuario) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return request.usuario.id_usuario;
  }
}