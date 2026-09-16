import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

/**
 * Identifica la dependencia que construye el transporte SMTP.
 * Permite sustituirla en las pruebas sin abrir conexiones reales.
 */
export const CREAR_TRANSPORTE_CORREO = Symbol(
  'CREAR_TRANSPORTE_CORREO',
);

export type CrearTransporteCorreo = (
  opciones: SMTPTransport.Options,
) => Transporter<SMTPTransport.SentMessageInfo>;

/**
 * Fábrica utilizada por la aplicación.
 * Las pruebas proporcionan su propia implementación.
 */
export const crearTransporteCorreo: CrearTransporteCorreo = (
  opciones,
) => nodemailer.createTransport(opciones);