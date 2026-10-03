import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Header,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Post,
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
    AgregarRecursoCarpetaDto,
} from './dto/agregar-recurso-carpeta.dto';

import {
    CarpetasRecursosService,
} from './carpetas-recursos.service';


/**
 * Expone la organización de recursos existentes
 * dentro de carpetas del proyecto.
 *
 * No crea copias físicas de fotografías,
 * panorámicas ni planos.
 */
@Controller(
    'proyectos/:idProyecto/carpetas',
)
@UseGuards(
    AuthGuard,
)
export class CarpetasRecursosController {
    constructor(
        private readonly recursosService:
            CarpetasRecursosService,
    ) { }

    /**
     * Agrega un recurso a una carpeta.
     *
     * Si el recurso ya se encontraba en otra
     * carpeta, se mueve a la nueva ubicación.
     *
     * Body:
     *
     * {
     *   "tipo": "FOTOGRAFIA",
     *   "id_recurso": "uuid"
     * }
     */
    @Post(
        ':idCarpeta/recursos',
    )
    @HttpCode(
        HttpStatus.NO_CONTENT,
    )
    @Header(
        'Cache-Control',
        'no-store',
    )
    async agregar(
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

        @Body()
        datos:
            AgregarRecursoCarpetaDto,
    ): Promise<void> {
        const usuario =
            request.usuario;

        if (
            !usuario
        ) {
            throw new UnauthorizedException(
                'La sesión no es válida o ha expirado.',
            );
        }

        await this.recursosService.agregar(
            idProyecto,
            idCarpeta,
            usuario.id_usuario,
            datos,
        );
    }


    /**
     * Quita un recurso de una carpeta.
     *
     * El recurso original permanece intacto.
     *
     * tipo debe ser:
     * - FOTOGRAFIA
     * - PANORAMICA
     * - PLANO
     */
    @Delete(
        ':idCarpeta/recursos/:tipo/:idRecurso',
    )
    @HttpCode(
        HttpStatus.NO_CONTENT,
    )
    @Header(
        'Cache-Control',
        'no-store',
    )
    async quitar(
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

        @Param(
            'tipo',
        )
        tipo: string,

        @Param(
            'idRecurso',
            new ParseUUIDPipe(),
        )
        idRecurso: string,

        @Req()
        request: AuthRequest,
    ): Promise<void> {
        const usuario =
            request.usuario;

        if (
            !usuario
        ) {
            throw new UnauthorizedException(
                'La sesión no es válida o ha expirado.',
            );
        }

        if (
            tipo !== 'FOTOGRAFIA' &&
            tipo !== 'PANORAMICA' &&
            tipo !== 'PLANO'
        ) {
            throw new BadRequestException(
                'Tipo de recurso no soportado.',
            );
        }

        await this.recursosService.quitar(
            idProyecto,
            idCarpeta,
            usuario.id_usuario,
            tipo,
            idRecurso,
        );
    }
}