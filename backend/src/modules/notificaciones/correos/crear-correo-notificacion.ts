import type { MensajeCorreo } from '../../correos/correo.service';

/**
 * Datos mínimos necesarios para preparar un correo.
 *
 * El destinatario debe proceder del usuario consultado en PostgreSQL,
 * nunca de un campo recibido directamente desde una petición HTTP.
 */
export interface DatosCorreoNotificacion {
  id_notificacion: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  correo_receptor: string;
}

/**
 * Construye el contenido sin enviar mensajes ni modificar datos.
 *
 * El asunto es fijo para evitar introducir contenido escrito por
 * usuarios en las cabeceras del correo. Los textos de la notificación
 * se incluyen exclusivamente en el cuerpo de texto plano.
 *
 * La referencia permite relacionar el correo con la notificación.
 * No constituye un mecanismo de deduplicación del envío SMTP.
 */
export function crearCorreoNotificacion(
  datos: DatosCorreoNotificacion,
): MensajeCorreo {
  if (datos.tipo !== 'INCIDENCIA_CREADA') {
    throw new Error(
      'El tipo de notificación no tiene una plantilla de correo.',
    );
  }

  return {
    destinatario: datos.correo_receptor,
    asunto: 'INGEVIT: nueva incidencia en un proyecto',
    texto: [
      'Se ha registrado una nueva incidencia en un proyecto al que tienes acceso.',
      '',
      datos.titulo,
      datos.mensaje,
      '',
      'Ingresa a INGEVIT para consultar los detalles.',
      '',
      `Referencia de notificación: ${datos.id_notificacion}`,
    ].join('\n'),
  };
}