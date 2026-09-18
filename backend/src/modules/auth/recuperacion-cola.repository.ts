import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface SolicitudRecuperacionPendiente {
  id_solicitud: string;
  correo: string;
}

/**
 * Cola de solicitudes, independiente de la existencia de usuarios.
 *
 * Cada operación utiliza una única sentencia SQL atómica.
 * No mantiene una transacción abierta durante el envío de correo.
 */
@Injectable()
export class RecuperacionColaRepository {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Recibe un correo previamente validado por el DTO.
   * Una solicitud repetida no cambia la antigüedad ni crea otra tarea.
   */
  async encolar(correo: string): Promise<void> {
    await this.database.query(
      `
        INSERT INTO obra.recuperacion_cola (correo)
        VALUES ($1)
        ON CONFLICT (lower(correo)) DO NOTHING
      `,
      [correo],
    );
  }

  /**
   * Reserva una tarea antes de devolverla al trabajador.
   *
   * SKIP LOCKED permite varios procesos sin seleccionar la misma fila.
   * Solo se procesan solicitudes con menos de 15 minutos.
   * Una reserva existente nunca se reutiliza.
   */
  async reservar(): Promise<SolicitudRecuperacionPendiente | null> {
    const resultado =
      await this.database.query<SolicitudRecuperacionPendiente>(
        `
          WITH candidata AS (
            SELECT id_solicitud
            FROM obra.recuperacion_cola
            WHERE fecha_reserva IS NULL
              AND fecha_creacion >
                  clock_timestamp() - interval '15 minutes'
            ORDER BY fecha_creacion, id_solicitud
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          )
          UPDATE obra.recuperacion_cola AS tarea
          SET fecha_reserva = clock_timestamp()
          FROM candidata
          WHERE tarea.id_solicitud = candidata.id_solicitud
          RETURNING tarea.id_solicitud, tarea.correo
        `,
      );

    return resultado.rows[0] ?? null;
  }

  /**
   * Retira una tarea cuyo procesamiento terminó.
   * No significa necesariamente que se haya enviado un correo:
   * la cuenta podría no ser recuperable o tener limitado el envío.
   */
  async completar(idSolicitud: string): Promise<void> {
    await this.database.query(
      `
        DELETE FROM obra.recuperacion_cola
        WHERE id_solicitud = $1
          AND fecha_reserva IS NOT NULL
      `,
      [idSolicitud],
    );
  }

  /**
   * Retira hasta 100 solicitudes antiguas por ciclo.
   *
   * Incluye reservas abandonadas: no se reenvían porque el resultado
   * de un envío interrumpido puede ser desconocido.
   *
   * El límite evita una limpieza masiva en una única operación.
   */
  async limpiarVencidas(): Promise<number> {
    const resultado = await this.database.query(
      `
        WITH vencidas AS (
          SELECT id_solicitud
          FROM obra.recuperacion_cola
          WHERE fecha_creacion <=
                clock_timestamp() - interval '15 minutes'
            AND (
              fecha_reserva IS NULL
              OR fecha_reserva <=
                 clock_timestamp() - interval '15 minutes'
            )
          ORDER BY fecha_creacion, id_solicitud
          LIMIT 100
          FOR UPDATE SKIP LOCKED
        )
        DELETE FROM obra.recuperacion_cola AS tarea
        USING vencidas
        WHERE tarea.id_solicitud = vencidas.id_solicitud
      `,
    );

    return resultado.rowCount ?? 0;
  }
}