import {
    Controller,
    Get,
    Header,
    Query,
    Req,
    UnauthorizedException,
    UseGuards,
    Param,
    ParseUUIDPipe,
    Post,
    HttpCode,
    HttpStatus,
    Body,
    Put,
    Delete
} from '@nestjs/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';
import { ListarProyectosQueryDto } from './dto/listar-proyectos-query.dto';
import { ProyectosService } from './proyectos.service';
import type { ProyectosPaginadosResponse } from './types/proyectos-paginados.types';
import type { ProyectoResponse } from './types/proyecto.types';
import { CrearProyectoDto } from './dto/crear-proyecto.dto';
import { ActualizarProyectoDto } from './dto/actualizar-proyecto.dto';
import { AgregarColaboradorDto } from './dto/agregar-colaborador.dto';

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

    /**
 * Crea un proyecto cuyo propietario es el usuario autenticado.
 *
 * AuthGuard se aplica a todo el controlador.
 * OriginGuard comprueba globalmente el origen de esta solicitud POST.
 * ValidationPipe valida CrearProyectoDto y rechaza campos adicionales.
 *
 * El servicio confirma proyecto y actividad en una misma transacción
 * antes de devolver el resultado.
 */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @Header('Cache-Control', 'no-store')
    async crear(
        @Req() request: AuthRequest,
        @Body() datos: CrearProyectoDto,
    ): Promise<ProyectoResponse> {
        const usuario = request.usuario;

        if (usuario === undefined) {
            throw new UnauthorizedException(
                'La sesión no es válida o ha expirado.',
            );
        }

        return this.proyectosService.crear(
            usuario.id_usuario,
            datos,
        );
    }


    /**
 * Reemplaza los datos editables de un proyecto.
 *
 * AuthGuard identifica al solicitante.
 * OriginGuard comprueba el origen de la solicitud PUT.
 * ParseUUIDPipe valida el identificador del proyecto.
 * ValidationPipe aplica las reglas de ActualizarProyectoDto.
 *
 * El servicio comprueba la propiedad dentro de la transacción.
 * Un colaborador o un administrador ajeno no puede editarlo.
 */
    @Put(':idProyecto')
    @Header('Cache-Control', 'no-store')
    async actualizar(
        @Param('idProyecto', new ParseUUIDPipe())
        idProyecto: string,
        @Req() request: AuthRequest,
        @Body() datos: ActualizarProyectoDto,
    ): Promise<ProyectoResponse> {
        const usuario = request.usuario;

        if (usuario === undefined) {
            throw new UnauthorizedException(
                'La sesión no es válida o ha expirado.',
            );
        }

        return this.proyectosService.actualizar(
            idProyecto,
            usuario.id_usuario,
            datos,
        );
    }

    /**
 * Elimina lógicamente un proyecto por solicitud de su propietario.
 *
 * AuthGuard identifica al solicitante.
 * OriginGuard comprueba el origen de esta solicitud DELETE.
 * ParseUUIDPipe valida el identificador del proyecto.
 *
 * El servicio comprueba la propiedad y registra el historial
 * dentro de la misma transacción.
 *
 * No elimina físicamente registros ni archivos.
 */
    @Delete(':idProyecto')
    @HttpCode(HttpStatus.NO_CONTENT)
    @Header('Cache-Control', 'no-store')
    async eliminarLogicamente(
        @Param('idProyecto', new ParseUUIDPipe())
        idProyecto: string,
        @Req() request: AuthRequest,
    ): Promise<void> {
        const usuario = request.usuario;

        if (usuario === undefined) {
            throw new UnauthorizedException(
                'La sesión no es válida o ha expirado.',
            );
        }

        await this.proyectosService.eliminarLogicamente(
            idProyecto,
            usuario.id_usuario,
        );
    }


    /**
 * Agrega un usuario existente como colaborador del proyecto.
 *
 * La identidad del actor procede exclusivamente de la sesión autenticada.
 * El servicio comprueba que sea el propietario y que el proyecto esté
 * disponible, y guarda la relación y su actividad en una misma transacción.
 *
 * Si la relación ya existe, la operación termina sin duplicarla ni generar
 * una nueva actividad.
 *
 * @returns HTTP 204, sin cuerpo, cuando la operación termina correctamente.
 */
    @Post(':idProyecto/colaboradores')
    @HttpCode(204)
    @Header('Cache-Control', 'no-store')
    async agregarColaborador(
        @Param('idProyecto', new ParseUUIDPipe())
        idProyecto: string,
        @Req() request: AuthRequest,
        @Body() datos: AgregarColaboradorDto,
    ): Promise<void> {
        const usuario = request.usuario;

        // Comprobación defensiva: AuthGuard debe haber establecido esta identidad.
        if (!usuario) {
            throw new UnauthorizedException(
                'La sesión no es válida o ha expirado.',
            );
        }

        await this.proyectosService.agregarColaborador(
            idProyecto,
            usuario.id_usuario,
            datos.id_usuario,
        );
    }

}