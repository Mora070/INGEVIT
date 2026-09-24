BEGIN;

ALTER TABLE obra.capas
    ADD COLUMN procesamiento_token uuid,
    ADD COLUMN procesamiento_inicio timestamptz;

/*
 * Cada intento activo tiene su propio identificador.
 * Al finalizar, estos campos se limpian.
 */
ALTER TABLE obra.capas
    ADD CONSTRAINT ck_capas_intento_procesamiento
    CHECK (
        (
            estado_procesamiento = 'PROCESANDO'
            AND procesamiento_token IS NOT NULL
            AND procesamiento_inicio IS NOT NULL
        )
        OR
        (
            estado_procesamiento <> 'PROCESANDO'
            AND procesamiento_token IS NULL
            AND procesamiento_inicio IS NULL
        )
    );

COMMENT ON COLUMN obra.capas.procesamiento_token IS
    'Identifica el intento activo. Solo ese intento puede finalizar o registrar su fallo. No se expone al cliente.';

COMMENT ON COLUMN obra.capas.procesamiento_inicio IS
    'Inicio del intento activo. Permitirá detectar trabajos interrumpidos.';

COMMIT;