import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { CorreoService } from '../../correos/correo.service';
import { crearCorreoNotificacion } from './crear-correo-notificacion';
import {
  NotificacionesCorreoRepository,
} from './notificaciones-correo.repository';

export type ResultadoProcesamientoCorreo =
  | 'SIN_PENDIENTES'
  | 'ENVIADA'
  | 'FALLIDA'
  | 'DESCARTADA'
  | 'RESERVA_PERDIDA';

/**
 * Coordina el procesamiento de una notificación.
 *
 * Las transacciones son breves y terminan antes de contactar con SMTP.
 * No inicia temporizadores ni realiza reintentos automáticos.
 *
 * Una reserva que queda pendiente por un error de PostgreSQL requiere
 * recuperación posterior. No debe reenviarse suponiendo que SMTP
 * no recibió el mensaje.
 */
@Injectable()
export class NotificacionesCorreoService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repository: NotificacionesCorreoRepository,
    private readonly correo: CorreoService,
  ) {}

  async procesarSiguiente(): Promise<ResultadoProcesamientoCorreo> {
    const reservada = await this.database.withTransaction(
      (client) => this.repository.reservarSiguiente(client, 120, 5),
    );

    if (!reservada) {
      return 'SIN_PENDIENTES';
    }

    const id = reservada.id_notificacion;
    const reserva = reservada.correo_reserva;

    /*
     * Solo llegamos aquí si la transacción de reserva fue confirmada.
     * Un error o resultado incierto de COMMIT impide comenzar el envío.
     */
    const datos = await this.database.withTransaction(
      (client) => this.repository.obtenerDatosParaEnvio(
        client,
        id,
        reserva,
      ),
    );

    if (!datos) {
      const actualizada = await this.finalizarFallida(id, reserva);

      // DESCARTADA es el resultado interno del procesamiento.
      // En PostgreSQL se registra como FALLIDA.
      return actualizada ? 'DESCARTADA' : 'RESERVA_PERDIDA';
    }

    try {
      const mensaje = crearCorreoNotificacion(datos);

      await this.correo.enviar(mensaje);
    } catch {
      /*
       * Por ahora finalizamos sin reintentar.
       *
       * Un error SMTP puede tener resultado incierto: FALLIDA describe
       * un procesamiento sin confirmación satisfactoria, no demuestra
       * que el destinatario no haya recibido el mensaje.
       *
       * No registramos direcciones, contenido ni errores SMTP completos.
       */
      const actualizada = await this.finalizarFallida(id, reserva);

      return actualizada ? 'FALLIDA' : 'RESERVA_PERDIDA';
    }

    /*
     * Debe permanecer fuera del catch del envío.
     *
     * Si SMTP aceptó el mensaje y esta actualización falla, propagamos
     * el error. No marcamos FALLIDA ni volvemos a llamar a SMTP.
     */
    const actualizada = await this.database.withTransaction(
      (client) => this.repository.marcarEnviada(
        client,
        id,
        reserva,
      ),
    );

    return actualizada ? 'ENVIADA' : 'RESERVA_PERDIDA';
  }

  private finalizarFallida(
    idNotificacion: string,
    reserva: string,
  ): Promise<boolean> {
    return this.database.withTransaction(
      (client) => this.repository.marcarFallida(
        client,
        idNotificacion,
        reserva,
      ),
    );
  }
}