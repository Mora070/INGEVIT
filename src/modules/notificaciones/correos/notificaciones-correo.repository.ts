import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { DatosCorreoNotificacion } from './crear-correo-notificacion';

export interface NotificacionCorreoReservada {
    id_notificacion: string;
    id_receptor: string;
    id_proyecto: string;
    tipo: string;
    titulo: string;
    mensaje: string;
    correo_intentos: number;
    correo_reserva: string;
    correo_reservado_hasta: Date;
}

/**
 * Administra las reservas de procesamiento de correo.
 *
 * Todos los métodos requieren el cliente de una transacción.
 * El servicio coordinador debe confirmar la reserva ANTES de enviar.
 *
 * Este repositorio no envía correos ni comprueba acceso al proyecto.
 * Esas comprobaciones se realizarán antes del envío.
 */
@Injectable()
export class NotificacionesCorreoRepository {
    /**
     * Reserva como máximo una notificación disponible.
     *
     * SKIP LOCKED permite que trabajadores concurrentes seleccionen
     * filas diferentes sin esperar la reserva de otro trabajador.
     *
     * No recupera reservas vencidas: una expiración no demuestra que
     * el intento anterior no haya enviado el mensaje.
     */
    async reservarSiguiente(
        client: PoolClient,
        segundosReserva: number,
        maxIntentos: number,
    ): Promise<NotificacionCorreoReservada | null> {
        this.validarLimites(segundosReserva, maxIntentos);

        const reserva = randomUUID();

        const resultado = await client.query<NotificacionCorreoReservada>(
            `
        WITH candidata AS (
          SELECT n.id_notificacion
          FROM obra.notificaciones n
          WHERE n.estado_envio_correo = 'PENDIENTE'
            AND n.correo_reserva IS NULL
            AND n.correo_proximo_intento <= CURRENT_TIMESTAMP
            AND n.correo_intentos < $3
          ORDER BY
            n.correo_proximo_intento,
            n.fecha_creacion,
            n.id_notificacion
          LIMIT 1
          FOR UPDATE OF n SKIP LOCKED
        )
        UPDATE obra.notificaciones n
        SET
          correo_reserva = $1::uuid,
          correo_reservado_hasta =
            clock_timestamp() + ($2::integer * INTERVAL '1 second'),
          correo_intentos = n.correo_intentos + 1
        FROM candidata c
        WHERE n.id_notificacion = c.id_notificacion
        RETURNING
          n.id_notificacion,
          n.id_receptor,
          n.id_proyecto,
          n.tipo,
          n.titulo,
          n.mensaje,
          n.correo_intentos,
          n.correo_reserva,
          n.correo_reservado_hasta
      `,
            [reserva, segundosReserva, maxIntentos],
        );

        return resultado.rows[0] ?? null;
    }

    /**
     * Registra la aceptación SMTP y libera la reserva.
     *
     * Devuelve false si la reserva ya no pertenece al intento,
     * está vencida o la notificación dejó de estar pendiente.
     *
     * El llamador no debe interpretar false como un envío fallido
     * ni reenviar automáticamente: SMTP podría haberlo aceptado.
     */
    async marcarEnviada(
        client: PoolClient,
        idNotificacion: string,
        reserva: string,
    ): Promise<boolean> {
        const resultado = await client.query(
            `
        UPDATE obra.notificaciones
        SET
          estado_envio_correo = 'ENVIADA',
          correo_reserva = NULL,
          correo_reservado_hasta = NULL
        WHERE id_notificacion = $1::uuid
          AND correo_reserva = $2::uuid
          AND estado_envio_correo = 'PENDIENTE'
          AND correo_reservado_hasta > clock_timestamp()
      `,
            [idNotificacion, reserva],
        );

        return resultado.rowCount === 1;
    }

    /**
     * Finaliza el procesamiento sin programar otro intento.
     *
     * FALLIDA no demuestra que el destinatario no recibió un correo.
     * La clasificación del error corresponde al servicio coordinador.
     */
    async marcarFallida(
        client: PoolClient,
        idNotificacion: string,
        reserva: string,
    ): Promise<boolean> {
        const resultado = await client.query(
            `
        UPDATE obra.notificaciones
        SET
          estado_envio_correo = 'FALLIDA',
          correo_reserva = NULL,
          correo_reservado_hasta = NULL
        WHERE id_notificacion = $1::uuid
          AND correo_reserva = $2::uuid
          AND estado_envio_correo = 'PENDIENTE'
          AND correo_reservado_hasta > clock_timestamp()
      `,
            [idNotificacion, reserva],
        );

        return resultado.rowCount === 1;
    }

    /**
   * Consulta el contenido y el correo actual del destinatario.
   *
   * Requiere una reserva vigente perteneciente al intento recibido.
   * Comprueba que el receptor conserve acceso al proyecto.
   *
   * Devuelve null si la notificación ya no puede enviarse.
   * Los errores de PostgreSQL se propagan: no representan falta
   * de permisos ni deben confundirse con un resultado vacío.
   *
   * No bloquea usuarios o proyectos durante el posterior envío SMTP.
   */
    async obtenerDatosParaEnvio(
        client: PoolClient,
        idNotificacion: string,
        reserva: string,
    ): Promise<DatosCorreoNotificacion | null> {
        const resultado = await client.query<DatosCorreoNotificacion>(
            `
        SELECT
          n.id_notificacion,
          n.tipo,
          n.titulo,
          n.mensaje,
          receptor.correo AS correo_receptor
        FROM obra.notificaciones n
        JOIN obra.usuarios receptor
          ON receptor.id_usuario = n.id_receptor
        JOIN obra.proyectos proyecto
          ON proyecto.id_proyecto = n.id_proyecto
        JOIN obra.usuarios propietario
          ON propietario.id_usuario = proyecto.id_propietario
        WHERE n.id_notificacion = $1::uuid
          AND n.correo_reserva = $2::uuid
          AND n.estado_envio_correo = 'PENDIENTE'
          AND n.correo_reservado_hasta > clock_timestamp()
          AND receptor.estado = 'ACTIVO'
          AND propietario.estado = 'ACTIVO'
          AND proyecto.activo = TRUE
          AND (
            proyecto.id_propietario = receptor.id_usuario
            OR EXISTS (
              SELECT 1
              FROM obra.usuario_proyecto colaboracion
              WHERE colaboracion.id_proyecto = proyecto.id_proyecto
                AND colaboracion.id_usuario = receptor.id_usuario
            )
          )
      `,
            [idNotificacion, reserva],
        );

        return resultado.rows[0] ?? null;
    }

    private validarLimites(
        segundosReserva: number,
        maxIntentos: number,
    ): void {
        if (
            !Number.isInteger(segundosReserva) ||
            segundosReserva < 30 ||
            segundosReserva > 3_600
        ) {
            throw new Error(
                'La duración de la reserva debe estar entre 30 y 3600 segundos.',
            );
        }

        if (
            !Number.isInteger(maxIntentos) ||
            maxIntentos < 1 ||
            maxIntentos > 100
        ) {
            throw new Error(
                'El máximo de intentos debe estar entre 1 y 100.',
            );
        }
    }
}