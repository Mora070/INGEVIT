import {
    Controller,
    Get,
    Header,
    Query,
    Req,
    UnauthorizedException,
    UseGuards,
    Param,
    ParseUUIDPipe
} from '@nestjs/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';
import { ListarProyectosQueryDto } from './dto/listar-proyectos-query.dto';
import { ProyectosService } from './proyectos.service';
import type { ProyectosPaginadosResponse } from './types/proyectos-paginados.types';
import type { ProyectoResponse } from './types/proyecto.types';

/**
 * Expone las operaciones HTTP de proyectos.
 *
 * Todas las rutas de este controlador requieren una cuenta activa.
 * Los permisos sobre cada proyecto se aplican en sus casos de uso.
 */
@Controller('proyectos')
@UseGuards(AuthGuard)
export class ProyectosController {
    constructor(
        private readonly proyectosService: ProyectosService,
    ) { }

    /**
     * Lista los proyectos disponibles para el usuario autenticado.
     *
     * La identidad procede del guard.
     * El DTO valida exclusivamente los parámetros de paginación.
     *
     * No utilizamos RolesGuard: tanto USUARIO como ADMINISTRADOR
     * pueden consultar los proyectos a los que tienen acceso.
     */
    @Get()
    @Header('Cache-Control', 'no-store')
    async listar(
        @Req() request: AuthRequest,
        @Query() consulta: ListarProyectosQueryDto,
    ): Promise<ProyectosPaginadosResponse> {
        const usuario = request.usuario;

        if (usuario === undefined) {
            throw new UnauthorizedException(
                'La sesión no es válida o ha expirado.',
            );
        }

        return this.proyectosService.listarDisponibles(
            usuario.id_usuario,
            consulta,
        );
    }

    /**
     * Devuelve un proyecto disponible para el usuario autenticado.
     *
     * ParseUUIDPipe valida el identificador recibido en la ruta.
     * La identidad del solicitante procede exclusivamente de AuthGuard.
     *
     * El servicio devuelve 404 tanto para proyectos inexistentes
     * como para proyectos no accesibles.
     */
    @Get(':idProyecto')
    @Header('Cache-Control', 'no-store')
    async obtenerDetalle(
        @Param('idProyecto', new ParseUUIDPipe())
        idProyecto: string,
        @Req() request: AuthRequest,
    ): Promise<ProyectoResponse> {
        const usuario = request.usuario;

        if (usuario === undefined) {
            throw new UnauthorizedException(
                'La sesión no es válida o ha expirado.',
            );
        }

        return this.proyectosService.obtenerDetalle(
            idProyecto,
            usuario.id_usuario,
        );
    }

}