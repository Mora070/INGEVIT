import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

/**
 * Datos internos para registrar una notificación.
 *
 * El servicio determina destinatario, actor y contenido.
 * Este contrato no debe utilizarse como DTO de una ruta pública.
 */
export interface CrearNotificacionInput {
    id_receptor: string;
    id_actor: string;
    id_proyecto: string;
    id_incidencia: string | null;
    tipo: string;
    titulo: string;
    mensaje: string;
}



/**
 * Registra notificaciones mediante la conexión de la operación de negocio.
 *
 * No selecciona destinatarios, comprueba permisos ni envía correos.
 * No abre ni confirma transacciones.
 */
@Injectable()
export class NotificacionesRepository {
    /**
     * Inserta una notificación.
     *
     * PostgreSQL genera el identificador y la fecha.
     * estado_envio_correo utiliza su valor predeterminado PENDIENTE.
     *
     * Cualquier error se propaga para impedir confirmar una operación
     * que deba incluir esta notificación.
     */
    async crear(
        client: PoolClient,
        datos: CrearNotificacionInput,
    ): Promise<void> {
        const resultado = await client.query(
            `
        INSERT INTO obra.notificaciones (
          id_receptor,
          id_actor,
          id_proyecto,
          id_incidencia,
          tipo,
          titulo,
          mensaje
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
            [
                datos.id_receptor,
                datos.id_actor,
                datos.id_proyecto,
                datos.id_incidencia,
                datos.tipo,
                datos.titulo,
                datos.mensaje,
            ],
        );

        if (resultado.rowCount !== 1) {
            throw new Error(
                'No se pudo registrar exactamente una notificación.',
            );
        }
    }


}