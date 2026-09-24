BEGIN;

CREATE TABLE obra.capas_pendientes_eliminacion (
    id_capa uuid PRIMARY KEY,
    original_key text NOT NULL,
    teselas_version uuid,
    fecha_creacion timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_proximo_intento timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_capas_pendientes_original
    CHECK (
        original_key ~
        '^capas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(tif|tiff)$'
    )
);

CREATE INDEX idx_capas_pendientes_intento
ON obra.capas_pendientes_eliminacion (
    fecha_proximo_intento,
    fecha_creacion,
    id_capa
);

COMMENT ON TABLE obra.capas_pendientes_eliminacion IS
    'Limpieza persistente del original local y de la versión publicada de una capa eliminada. Sin FK a la capa porque debe sobrevivir a su eliminación.';

GRANT SELECT, INSERT, UPDATE, DELETE
ON obra.capas_pendientes_eliminacion
TO user_java;

COMMIT;