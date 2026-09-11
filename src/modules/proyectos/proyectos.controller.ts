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
    Delete,
    UseInterceptors,
    UploadedFile
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
import type {
    ParticipanteProyectoResponse,
} from './types/participante-proyecto.types';

import {
    ActividadesService,
} from '../actividades/actividades.service';

import {
    ListarActividadesQueryDto,
} from '../actividades/dto/listar-actividades-query.dto';

import type {
    ActividadesPaginadasResponse,
} from '../actividades/types/actividades-paginadas.types';

import {
    FotografiasService,
} from '../fotografias/fotografias.service';

import {
    ListarFotografiasQueryDto,
} from '../fotografias/dto/listar-fotografias-query.dto';

import type {
    FotografiasPaginadasResponse,
} from '../fotografias/types/fotografias-paginadas.types';

import { FileInterceptor } from '@nestjs/platform-express';

import {
    FotografiasSubidaService,
} from '../fotografias/fotografias-subida.service';

import {
    SubirFotografiaDto,
} from '../fotografias/dto/subir-fotografia.dto';

import {
    ContenidoFotografiaPipe,
} from '../fotografias/pipes/contenido-fotografia.pipe';

import {
    getSubidaFotografiaConfig,
} from '../fotografias/config/subida-fotografia.config';

import type {
    FotografiaResponse,
} from '../fotografias/types/fotografia.types';

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
        private readonly actividadesService: ActividadesService,
        private readonly fotografiasService: FotografiasService,
        private readonly fotografiasSubidaService: FotografiasSubidaService,
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


    /**
 * Retira la relación de colaboración de un usuario con el proyecto.
 *
 * La identidad del actor procede de la sesión autenticada.
 * El servicio comprueba la propiedad y disponibilidad del proyecto,
 * y registra la retirada dentro de la misma transacción.
 *
 * Conserva al usuario, sus incidencias y su historial.
 * No modifica quién es el propietario del proyecto.
 *
 * @returns HTTP 204 sin cuerpo, incluso si la relación ya no existía.
 */
    @Delete(':idProyecto/colaboradores/:idUsuario')
    @HttpCode(204)
    @Header('Cache-Control', 'no-store')
    async retirarColaborador(
        @Param('idProyecto', new ParseUUIDPipe())
        idProyecto: string,
        @Param('idUsuario', new ParseUUIDPipe())
        idUsuario: string,
        @Req() request: AuthRequest,
    ): Promise<void> {
        const usuario = request.usuario;

        // AuthGuard establece la identidad; mantenemos esta comprobación defensiva.
        if (!usuario) {
            throw new UnauthorizedException(
                'La sesión no es válida o ha expirado.',
            );
        }

        await this.proyectosService.retirarColaborador(
            idProyecto,
            usuario.id_usuario,
            idUsuario,
        );
    }


    /**
 * Devuelve al propietario y a los colaboradores del proyecto.
 *
 * La identidad del solicitante procede exclusivamente de la sesión.
 * El servicio devuelve 404 si el proyecto no está disponible para él.
 *
 * Cada usuario aparece una sola vez y el propietario aparece primero.
 */
    @Get(':idProyecto/participantes')
    @Header('Cache-Control', 'no-store')
    async listarParticipantes(
        @Param('idProyecto', new ParseUUIDPipe())
        idProyecto: string,
        @Req() request: AuthRequest,
    ): Promise<ParticipanteProyectoResponse[]> {
        const usuario = request.usuario;

        // AuthGuard debe haber establecido la identidad autenticada.
        if (!usuario) {
            throw new UnauthorizedException(
                'La sesión no es válida o ha expirado.',
            );
        }

        return this.proyectosService.listarParticipantes(
            idProyecto,
            usuario.id_usuario,
        );
    }


    /**
 * Devuelve una página del historial del proyecto.
 *
 * La identidad procede de la sesión autenticada.
 * El servicio comprueba la disponibilidad del proyecto para el solicitante.
 *
 * Omitir los parámetros utiliza la página 1 y un límite de 20.
 */
    @Get(':idProyecto/actividades')
    @Header('Cache-Control', 'no-store')
    async listarActividades(
        @Param('idProyecto', new ParseUUIDPipe())
        idProyecto: string,
        @Req() request: AuthRequest,
        @Query() consulta: ListarActividadesQueryDto,
    ): Promise<ActividadesPaginadasResponse> {
        const usuario = request.usuario;

        if (!usuario) {
            throw new UnauthorizedException(
                'La sesión no es válida o ha expirado.',
            );
        }

        return this.actividadesService.listarDisponibles(
            idProyecto,
            usuario.id_usuario,
            consulta,
        );
    }

    /**
     * Devuelve una página de fotografías del proyecto.
     *
     * La identidad del solicitante procede exclusivamente de la sesión.
     * El servicio comprueba el acceso y devuelve únicamente metadatos públicos.
     *
     * Esta ruta no descarga ni modifica archivos.
     */
    @Get(':idProyecto/fotografias')
    @Header('Cache-Control', 'no-store')
    async listarFotografias(
        @Param('idProyecto', new ParseUUIDPipe())
        idProyecto: string,
        @Req() request: AuthRequest,
        @Query() consulta: ListarFotografiasQueryDto,
    ): Promise<FotografiasPaginadasResponse> {
        const usuario = request.usuario;

        if (!usuario) {
            throw new UnauthorizedException(
                'La sesión no es válida o ha expirado.',
            );
        }

        return this.fotografiasService.listarDisponibles(
            idProyecto,
            usuario.id_usuario,
            consulta,
        );
    }


    /**
 * Sube una fotografía al proyecto.
 *
 * Recibe multipart/form-data:
 * - titulo: datos validados mediante SubirFotografiaDto.
 * - archivo: fotografía original, hasta 20 MiB.
 *
 * AuthGuard identifica al solicitante antes de recibir el archivo.
 * OriginGuard aplica la comprobación global del origen del POST.
 *
 * El interceptor recibe el archivo en memoria y aplica sus límites.
 * El pipe extrae el Buffer sin modificar los bytes originales.
 *
 * El servicio comprueba el acceso al proyecto, procesa la imagen
 * y coordina el almacenamiento con el registro de la actividad.
 *
 * Devuelve los metadatos públicos con la URL de la versión optimizada.
 */
    @Post(':idProyecto/fotografias')
    @HttpCode(HttpStatus.CREATED)
    @Header('Cache-Control', 'no-store')
    @UseInterceptors(
        FileInterceptor('archivo', getSubidaFotografiaConfig()),
    )
    async subirFotografia(
        @Param('idProyecto', new ParseUUIDPipe())
        idProyecto: string,
        @Req() request: AuthRequest,
        @Body() datos: SubirFotografiaDto,
        @UploadedFile(new ContenidoFotografiaPipe())
        contenido: Buffer,
    ): Promise<FotografiaResponse> {
        const usuario = request.usuario;

        // La identidad procede de la sesión, nunca del formulario.
        if (!usuario) {
            throw new UnauthorizedException(
                'La sesión no es válida o ha expirado.',
            );
        }

        return this.fotografiasSubidaService.subir(
            idProyecto,
            usuario.id_usuario,
            datos,
            contenido,
        );
    }


}