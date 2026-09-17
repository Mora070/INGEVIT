import {
    Body,
    Controller,
    Header,
    HttpCode,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import {
    RecuperacionPasswordService,
} from './services/recuperacion-password.service';
import {
    SolicitarRecuperacionDto,
} from './dto/solicitar-recuperacion.dto';
import {
    RestablecerPasswordDto,
} from './dto/restablecer-password.dto';

import {
    RecuperacionSolicitudesService,
} from './services/recuperacion-solicitudes.service';

/**
 * No exige sesión: permite recuperar el acceso.
 * OriginGuard protege globalmente las solicitudes.
 * ThrottlerGuard aplica el límite de autenticación por IP y ruta.
 */
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class RecuperacionPasswordController {
    constructor(
        private readonly recuperacion: RecuperacionPasswordService,
        private readonly solicitudes: RecuperacionSolicitudesService,
    ) { }

    @Post('recuperar-password')
    @HttpCode(200)
    @Header('Cache-Control', 'no-store')
    async solicitar(
        @Body() datos: SolicitarRecuperacionDto,
    ): Promise<{ message: string }> {
        return this.solicitudes.solicitar(datos.correo);
    }

    /**
     * No inicia sesión automáticamente.
     * Las sesiones anteriores quedan invalidadas por version_sesion.
     */
    @Post('restablecer-password')
    @HttpCode(204)
    @Header('Cache-Control', 'no-store')
    async restablecer(
        @Body() datos: RestablecerPasswordDto,
    ): Promise<void> {
        await this.recuperacion.restablecer(
            datos.correo,
            datos.codigo,
            datos.password_nueva,
        );
    }
}