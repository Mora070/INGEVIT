BEGIN;

ALTER TABLE obra.notificaciones
  ADD COLUMN correo_intentos integer NOT NULL DEFAULT 0,
  ADD COLUMN correo_proximo_intento timestamptz NOT NULL
    DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN correo_reserva uuid,
  ADD COLUMN correo_reservado_hasta timestamptz;

ALTER TABLE obra.notificaciones
  ADD CONSTRAINT ck_notificaciones_correo_intentos
    CHECK (correo_intentos >= 0),

  ADD CONSTRAINT ck_notificaciones_correo_reserva
    CHECK (
      (
        correo_reserva IS NULL
        AND correo_reservado_hasta IS NULL
      )
      OR
      (
        correo_reserva IS NOT NULL
        AND correo_reservado_hasta IS NOT NULL
        AND estado_envio_correo = 'PENDIENTE'
      )
    );

-- Facilita seleccionar notificaciones pendientes cuya fecha
-- de próximo intento ya haya llegado.
CREATE INDEX idx_notificaciones_correo_programado
  ON obra.notificaciones (
    correo_proximo_intento,
    fecha_creacion,
    id_notificacion
  )
  WHERE estado_envio_correo = 'PENDIENTE';

COMMENT ON COLUMN obra.notificaciones.correo_intentos IS
  'Cantidad de intentos de procesamiento reservados. No acredita envíos SMTP.';

COMMENT ON COLUMN obra.notificaciones.correo_proximo_intento IS
  'Fecha mínima para volver a considerar la notificación para envío.';

COMMENT ON COLUMN obra.notificaciones.correo_reserva IS
  'Identificador del intento autorizado para actualizar el resultado del envío.';

COMMENT ON COLUMN obra.notificaciones.correo_reservado_hasta IS
  'Vencimiento de la reserva. Su expiración no demuestra que SMTP no recibió el mensaje.';

COMMIT;