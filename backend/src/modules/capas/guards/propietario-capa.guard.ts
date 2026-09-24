import {
    Injectable,
    NotFoundException,
    ParseUUIDPipe,
    UnauthorizedException,
    BadRequestException,
} from '@nestjs/common';
import type {
    CanActivate,
    ExecutionContext,
} from '@nestjs/common';

import { ProyectosRepository } from '../../proyectos/proyectos.repository';
import type { AuthRequest } from '../../auth/types/auth-request.types';

/**
 * Comprueba el permiso antes de recibir el archivo.
 *
 * Debe ejecutarse después de AuthGuard.
 * Solo permite gestionar capas al propietario activo del proyecto.
 *
 * Esta comprobación no mantiene bloqueos durante la subida.
 * El servicio de persistencia deberá comprobar nuevamente los permisos
 * dentro de su transacción, porque pueden cambiar durante la recepción.
 */
@Injectable()
export class PropietarioCapaGuard implements CanActivate {
    private readonly validarUuid = new ParseUUIDPipe();

    constructor(
        private readonly proyectos: ProyectosRepository,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<AuthRequest>();
        const usuario = request.usuario;

        if (!usuario) {
            throw new UnauthorizedException(
                'La sesión no es válida o ha expirado.',
            );
        }

        /*
         * Los guards se ejecutan antes de los pipes del controlador.
         * Validamos aquí el parámetro antes de consultarlo en PostgreSQL.
         */
        const parametroProyecto = request.params.idProyecto;

        if (typeof parametroProyecto !== 'string') {
            throw new BadRequestException(
                'El identificador del proyecto debe ser un UUID válido.',
            );
        }

        const idProyecto = await this.validarUuid.transform(
            parametroProyecto,
            {
                type: 'param',
                data: 'idProyecto',
                metatype: String,
            },
        );

        const proyecto = await this.proyectos.findDisponibleById(
            idProyecto,
            usuario.id_usuario,
        );

        if (
            !proyecto
            || proyecto.id_propietario !== usuario.id_usuario
        ) {
            throw new NotFoundException(
                'El proyecto no está disponible para gestionar capas.',
            );
        }

        return true;
    }
}