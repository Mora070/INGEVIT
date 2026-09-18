BEGIN;

-- Cola técnica persistente.
-- Cada fila representa un archivo cuyo borrado debe completarse.
CREATE TABLE obra.archivos_pendientes_eliminacion (
    s3_key text PRIMARY KEY,

    fecha_creacion timestamptz NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_archivos_pendientes_clave
        CHECK (
            s3_key = btrim(s3_key)
            AND s3_key <> ''
        )
);

-- Permite consultar tareas pendientes en un orden estable.
CREATE INDEX idx_archivos_pendientes_fecha_clave
    ON obra.archivos_pendientes_eliminacion (
        fecha_creacion,
        s3_key
    );

COMMENT ON TABLE obra.archivos_pendientes_eliminacion IS
    'Cola técnica de archivos cuyo borrado debe completarse después de confirmar su eliminación lógica en PostgreSQL.';

COMMENT ON COLUMN obra.archivos_pendientes_eliminacion.s3_key IS
    'Clave interna del archivo. No contiene una ruta absoluta ni una URL.';

COMMENT ON COLUMN obra.archivos_pendientes_eliminacion.fecha_creacion IS
    'Fecha en que se registró la tarea pendiente.';

COMMIT;