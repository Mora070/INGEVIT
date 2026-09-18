BEGIN;

CREATE TABLE obra.recuperacion_cola (
    id_solicitud uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    correo text NOT NULL,
    fecha_creacion timestamptz NOT NULL DEFAULT clock_timestamp(),
    fecha_reserva timestamptz,

    CONSTRAINT ck_recuperacion_cola_correo
        CHECK (
            correo = btrim(correo)
            AND length(correo) BETWEEN 3 AND 254
        )
);

-- Agrupa solicitudes repetidas mientras una tarea siga pendiente
-- o reservada. También se aplica a correos sin cuenta.
CREATE UNIQUE INDEX uq_recuperacion_cola_correo
    ON obra.recuperacion_cola (lower(correo));

CREATE INDEX idx_recuperacion_cola_pendientes
    ON obra.recuperacion_cola (fecha_creacion, id_solicitud)
    WHERE fecha_reserva IS NULL;

CREATE INDEX idx_recuperacion_cola_limpieza
    ON obra.recuperacion_cola (fecha_creacion, id_solicitud);

COMMENT ON TABLE obra.recuperacion_cola IS
    'Solicitudes de recuperación pendientes de evaluar. No almacena códigos ni consulta la existencia de la cuenta al encolar.';

COMMENT ON COLUMN obra.recuperacion_cola.fecha_reserva IS
    'Reserva exclusiva. Una tarea reservada no se vuelve a ejecutar automáticamente.';

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE obra.recuperacion_cola
    TO user_java;

COMMIT;