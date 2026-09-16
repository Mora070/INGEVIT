import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { isEmail } from 'class-validator';
//import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { CREAR_TRANSPORTE_CORREO } from './correo-transporte';
import type { CrearTransporteCorreo } from './correo-transporte';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { getCorreoConfig } from './correo.config';

export interface MensajeCorreo {
    destinatario: string;
    asunto: string;
    texto: string;
}

export interface ResultadoEnvioCorreo {
    messageId: string;
}

/**
 * Envía un mensaje de texto a un único destinatario.
 *
 * No consulta notificaciones ni modifica su estado en PostgreSQL.
 * El procesador de notificaciones coordinará esas responsabilidades.
 *
 * No realiza reintentos ni registra direcciones o contenido.
 */
@Injectable()
export class CorreoService implements OnApplicationShutdown {
    private readonly config = getCorreoConfig();

    private readonly transport: Transporter<SMTPTransport.SentMessageInfo>;

    constructor(
        @Inject(CREAR_TRANSPORTE_CORREO) crearTransporte: CrearTransporteCorreo,
    ) {
        this.transport = crearTransporte({
            host: this.config.host,
            port: this.config.port,
            secure: false,
            ignoreTLS: true,
            pool: false,
            connectionTimeout: 5_000,
            greetingTimeout: 5_000,
            socketTimeout: 15_000,
            disableFileAccess: true,
            disableUrlAccess: true,
            logger: false,
            debug: false,
        });
    }

    /**
     * Devuelve el identificador cuando SMTP acepta el mensaje.
     *
     * La aceptación SMTP no acredita que una persona haya recibido
     * o leído el correo. Los errores se propagan al procesador.
     */
    async enviar(
        mensaje: MensajeCorreo,
    ): Promise<ResultadoEnvioCorreo> {
        this.validarMensaje(mensaje);

        const resultado = await this.transport.sendMail({
            from: { ...this.config.remitente },
            to: [{ address: mensaje.destinatario, name: '' }],
            subject: mensaje.asunto,
            text: mensaje.texto,
        });

        // Al enviar a una única dirección esperamos una única aceptación.
        if (
            resultado.accepted.length !== 1 ||
            resultado.rejected.length !== 0
        ) {
            throw new Error('SMTP no aceptó el destinatario del correo.');
        }

        return {
            messageId: resultado.messageId,
        };
    }

    private validarMensaje(mensaje: MensajeCorreo): void {
        if (
            typeof mensaje.destinatario !== 'string' ||
            mensaje.destinatario !== mensaje.destinatario.trim() ||
            /[\r\n\u0000]/.test(mensaje.destinatario) ||
            !isEmail(mensaje.destinatario)
        ) {
            throw new Error('El destinatario del correo no es válido.');
        }

        if (
            typeof mensaje.asunto !== 'string' ||
            !mensaje.asunto.trim() ||
            /[\r\n\u0000]/.test(mensaje.asunto)
        ) {
            throw new Error('El asunto del correo no es válido.');
        }

        if (
            typeof mensaje.texto !== 'string' ||
            !mensaje.texto.trim() ||
            mensaje.texto.includes('\u0000')
        ) {
            throw new Error('El contenido del correo no es válido.');
        }
    }

    onApplicationShutdown(): void {
        this.transport.close();
    }
}