import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
} from '../auth/guards/auth.guard';

import type {
  AuthRequest,
} from '../auth/types/auth-request.types';

import {
  CarpetasConsultaService,
} from '../carpetas/carpetas-consulta.service';

import type {
  CarpetaResponse,
} from './types/carpeta.types';

import type {
  ContenidoCarpetaResponse,
} from '../carpetas/carpetas-consulta.service';


/**
 * Expone la consulta de la estructura
 * organizativa de carpetas del proyecto.
 */
@Controller(
  'proyectos/:idProyecto/carpetas',
)
@UseGuards(
  AuthGuard,
)
export class CarpetasConsultaController {
  constructor(
    private readonly consultaService:
      CarpetasConsultaService,
  ) { }

  /**
   * Lista carpetas de una ubicación.
   *
   * Sin query:
   *
   * GET /proyectos/:idProyecto/carpetas
   *
   * devuelve las carpetas raíz.
   *
   * Con:
   *
   * ?id_carpeta_padre=uuid
   *
   * devuelve las subcarpetas directas
   * de esa carpeta.
   */
  @Get()
  @Header(
    'Cache-Control',
    'no-store',
  )
  async listar(
    @Param(
      'idProyecto',
      new ParseUUIDPipe(),
    )
    idProyecto: string,

    @Req()
    request: AuthRequest,

    @Query(
      'id_carpeta_padre',
    )
    idCarpetaPadre?: string,
  ): Promise<CarpetaResponse[]> {
    const usuario =
      request.usuario;

    if (
      !usuario
    ) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    let padre:
      string | null =
      null;

    if (
      idCarpetaPadre !==
      undefined
    ) {
      /*
       * ParseUUIDPipe no se aplica directamente
       * aquí porque el query es opcional.
       *
       * Validamos el UUID únicamente cuando
       * el parámetro fue enviado.
       */
      padre =
        await new ParseUUIDPipe()
          .transform(
            idCarpetaPadre,
            {
              type: 'query',
              metatype: String,
              data:
                'id_carpeta_padre',
            },
          );
    }

    return this.consultaService.listar(
      idProyecto,
      usuario.id_usuario,
      padre,
    );
  }

  /**
   * Devuelve una carpeta junto con:
   *
   * - subcarpetas directas;
   * - fotografías;
   * - panorámicas;
   * - planos.
   */
  @Get(
    ':idCarpeta',
  )
  @Header(
    'Cache-Control',
    'no-store',
  )
  async obtenerContenido(
    @Param(
      'idProyecto',
      new ParseUUIDPipe(),
    )
    idProyecto: string,

    @Param(
      'idCarpeta',
      new ParseUUIDPipe(),
    )
    idCarpeta: string,

    @Req()
    request: AuthRequest,
  ): Promise<ContenidoCarpetaResponse> {
    const usuario =
      request.usuario;

    if (
      !usuario
    ) {
      throw new UnauthorizedException(
        'La sesión no es válida o ha expirado.',
      );
    }

    return this.consultaService.obtenerContenido(
      idProyecto,
      idCarpeta,
      usuario.id_usuario,
    );
  }
}