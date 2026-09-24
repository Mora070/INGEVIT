BEGIN;

/*
 * Una capa está LISTA cuando tiene ubicación geográfica
 * y una colección completa de teselas publicada.
 *
 * ck_capas_teselas, creada en la migración anterior,
 * comprueba la integridad de los metadatos de esa colección.
 */
ALTER TABLE obra.capas
    DROP CONSTRAINT ck_capas_lista;

ALTER TABLE obra.capas
    ADD CONSTRAINT ck_capas_lista
    CHECK (
        estado_procesamiento <> 'LISTA'
        OR (
            crs_original IS NOT NULL
            AND bbox_oeste IS NOT NULL
            AND bbox_sur IS NOT NULL
            AND bbox_este IS NOT NULL
            AND bbox_norte IS NOT NULL
            AND teselas_version IS NOT NULL
            AND teselas_proveedor IS NOT NULL
            AND teselas_zoom_min IS NOT NULL
            AND teselas_zoom_max IS NOT NULL
            AND teselas_tamano IS NOT NULL
            AND teselas_total IS NOT NULL
        )
    );

COMMENT ON CONSTRAINT ck_capas_lista ON obra.capas IS
    'Exige metadatos geográficos y una colección de teselas publicada. El trabajador debe verificar los archivos antes de marcar LISTA.';

COMMIT;