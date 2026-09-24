BEGIN;

ALTER TABLE obra.capas
    ADD COLUMN teselas_version uuid,
    ADD COLUMN teselas_proveedor text,
    ADD COLUMN teselas_zoom_min integer,
    ADD COLUMN teselas_zoom_max integer,
    ADD COLUMN teselas_tamano integer,
    ADD COLUMN teselas_total bigint;

/*
 * Los metadatos de publicación se guardan como un conjunto completo.
 *
 * Todos NULL:
 * todavía no existe una generación publicada.
 *
 * Todos presentes:
 * identifican una generación completa y sus características.
 *
 * Los avances parciales del procesamiento no se publican aquí.
 */
ALTER TABLE obra.capas
    ADD CONSTRAINT ck_capas_teselas
    CHECK (
        (
            teselas_version IS NULL
            AND teselas_proveedor IS NULL
            AND teselas_zoom_min IS NULL
            AND teselas_zoom_max IS NULL
            AND teselas_tamano IS NULL
            AND teselas_total IS NULL
        )
        OR
        (
            teselas_version IS NOT NULL
            AND teselas_proveedor IS NOT NULL
            AND teselas_zoom_min IS NOT NULL
            AND teselas_zoom_max IS NOT NULL
            AND teselas_tamano IS NOT NULL
            AND teselas_total IS NOT NULL

            AND teselas_proveedor IN ('LOCAL', 'S3')
            AND teselas_zoom_min >= 0
            AND teselas_zoom_max >= teselas_zoom_min
            AND teselas_tamano = 256
            AND teselas_total > 0
        )
    );

COMMENT ON COLUMN obra.capas.teselas_version IS
    'UUID generado por el backend para identificar una colección publicada de teselas PNG XYZ. No es una ruta ni un identificador de Mapbox.';

COMMENT ON COLUMN obra.capas.teselas_proveedor IS
    'Almacenamiento de las teselas publicadas: LOCAL o S3. Independiente del proveedor del GeoTIFF original.';

COMMENT ON COLUMN obra.capas.teselas_zoom_min IS
    'Primer nivel de zoom de la colección publicada. Los límites operativos se validan en el backend.';

COMMENT ON COLUMN obra.capas.teselas_zoom_max IS
    'Último nivel de zoom de la colección publicada. Debe ser mayor o igual al mínimo.';

COMMENT ON COLUMN obra.capas.teselas_tamano IS
    'Ancho y alto de cada tesela en píxeles. La implementación inicial utiliza 256 por 256.';

COMMENT ON COLUMN obra.capas.teselas_total IS
    'Cantidad real de archivos PNG de la colección publicada. No incluye el original ni archivos auxiliares.';

COMMIT;