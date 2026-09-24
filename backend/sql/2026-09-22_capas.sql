BEGIN;

CREATE TABLE obra.capas (
    id_capa uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    id_proyecto uuid NOT NULL
        REFERENCES obra.proyectos(id_proyecto)
        ON DELETE CASCADE,

    id_usuario_subida uuid NOT NULL
        REFERENCES obra.usuarios(id_usuario)
        ON DELETE RESTRICT,

    nombre text NOT NULL,
    descripcion text NOT NULL DEFAULT '',

    -- El nombre original es informativo; nunca se utiliza como ruta.
    nombre_archivo_original text NOT NULL,

    -- La clave la genera el backend.
    almacenamiento_proveedor text NOT NULL DEFAULT 'LOCAL',
    original_key text NOT NULL,
    tamano_original_bytes bigint NOT NULL,

    -- Se obtendrá del archivo, no de un valor declarado por el cliente.
    -- Puede contener una identificación EPSG o una definición WKT.
    crs_original text,

    -- Extensión transformada a WGS84, independiente del CRS original.
    bbox_oeste numeric,
    bbox_sur numeric,
    bbox_este numeric,
    bbox_norte numeric,

    estado_procesamiento text NOT NULL DEFAULT 'PENDIENTE',

    mapbox_source_id text,
    mapbox_tileset_id text,
    mapbox_job_id text,

    -- Mensaje controlado por el backend, sin credenciales ni respuestas crudas.
    error_procesamiento text,

    -- Configuración compartida por todos los miembros del proyecto.
    opacidad numeric NOT NULL DEFAULT 1,
    visible boolean NOT NULL DEFAULT true,
    orden integer NOT NULL DEFAULT 0,

    fecha_creacion timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_capas_nombre
        CHECK (btrim(nombre) <> ''),

    CONSTRAINT ck_capas_archivo_original
        CHECK (btrim(nombre_archivo_original) <> ''),

    CONSTRAINT ck_capas_proveedor
        CHECK (almacenamiento_proveedor IN ('LOCAL', 'S3')),

    CONSTRAINT ck_capas_original_key
        CHECK (
            original_key ~
            '^capas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](tif|tiff)$'
        ),

    CONSTRAINT uq_capas_original
        UNIQUE (almacenamiento_proveedor, original_key),

    CONSTRAINT ck_capas_tamano
        CHECK (tamano_original_bytes > 0),

    CONSTRAINT ck_capas_crs
        CHECK (crs_original IS NULL OR btrim(crs_original) <> ''),

    CONSTRAINT ck_capas_bbox
        CHECK (
            (
                bbox_oeste IS NULL
                AND bbox_sur IS NULL
                AND bbox_este IS NULL
                AND bbox_norte IS NULL
            )
            OR
            (
                bbox_oeste IS NOT NULL
                AND bbox_sur IS NOT NULL
                AND bbox_este IS NOT NULL
                AND bbox_norte IS NOT NULL
                AND bbox_oeste BETWEEN -180 AND 180
                AND bbox_este BETWEEN -180 AND 180
                AND bbox_sur BETWEEN -90 AND 90
                AND bbox_norte BETWEEN -90 AND 90
                AND bbox_oeste < bbox_este
                AND bbox_sur < bbox_norte
            )
        ),

    CONSTRAINT ck_capas_estado
        CHECK (
            estado_procesamiento IN (
                'PENDIENTE',
                'PROCESANDO',
                'LISTA',
                'ERROR'
            )
        ),

    CONSTRAINT ck_capas_mapbox_source
        CHECK (
            mapbox_source_id IS NULL
            OR btrim(mapbox_source_id) <> ''
        ),

    CONSTRAINT ck_capas_mapbox_tileset
        CHECK (
            mapbox_tileset_id IS NULL
            OR btrim(mapbox_tileset_id) <> ''
        ),

    CONSTRAINT ck_capas_mapbox_job
        CHECK (
            mapbox_job_id IS NULL
            OR btrim(mapbox_job_id) <> ''
        ),

    CONSTRAINT ck_capas_error
        CHECK (
            (
                estado_procesamiento = 'ERROR'
                AND error_procesamiento IS NOT NULL
                AND btrim(error_procesamiento) <> ''
            )
            OR
            (
                estado_procesamiento <> 'ERROR'
                AND error_procesamiento IS NULL
            )
        ),

    -- LISTA significa que el backend ha verificado la publicación.
    -- Esta restricción exige sus metadatos mínimos.
    CONSTRAINT ck_capas_lista
        CHECK (
            estado_procesamiento <> 'LISTA'
            OR
            (
                crs_original IS NOT NULL
                AND bbox_oeste IS NOT NULL
                AND bbox_sur IS NOT NULL
                AND bbox_este IS NOT NULL
                AND bbox_norte IS NOT NULL
                AND mapbox_source_id IS NOT NULL
                AND mapbox_tileset_id IS NOT NULL
                AND mapbox_job_id IS NOT NULL
            )
        ),

    CONSTRAINT ck_capas_opacidad
        CHECK (opacidad BETWEEN 0 AND 1),

    CONSTRAINT ck_capas_orden
        CHECK (orden >= 0),

    CONSTRAINT ck_capas_fechas
        CHECK (fecha_actualizacion >= fecha_creacion)
);

-- El identificador permite resolver empates de orden.
CREATE INDEX idx_capas_proyecto_orden
    ON obra.capas (id_proyecto, orden, id_capa);

CREATE INDEX idx_capas_usuario_subida
    ON obra.capas (id_usuario_subida);

-- Cada capa tendrá sus propios recursos remotos.
CREATE UNIQUE INDEX uq_capas_mapbox_source
    ON obra.capas (mapbox_source_id)
    WHERE mapbox_source_id IS NOT NULL;

CREATE UNIQUE INDEX uq_capas_mapbox_tileset
    ON obra.capas (mapbox_tileset_id)
    WHERE mapbox_tileset_id IS NOT NULL;

COMMENT ON TABLE obra.capas IS
    'Capas raster del proyecto. El propietario administra archivos y presentación; los colaboradores pueden consultarlas.';

COMMENT ON COLUMN obra.capas.original_key IS
    'Clave interna del GeoTIFF original. No es una URL pública ni una ruta proporcionada por el cliente.';

COMMENT ON COLUMN obra.capas.crs_original IS
    'Sistema de referencia extraído del GeoTIFF. No implica que el archivo original esté en WGS84.';

COMMENT ON COLUMN obra.capas.bbox_oeste IS
    'Extensión WGS84 en grados: oeste, sur, este y norte. Inicialmente solo extensiones que no cruzan el antimeridiano.';

COMMENT ON COLUMN obra.capas.visible IS
    'Preferencia compartida de visualización. Solo se renderiza si además está LISTA.';

COMMENT ON COLUMN obra.capas.orden IS
    'Orden compartido ascendente; valores mayores se dibujan encima. Empates resueltos por id_capa.';

COMMENT ON COLUMN obra.capas.fecha_actualizacion IS
    'El repositorio debe actualizar esta fecha al modificar el registro.';

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE obra.capas
    TO user_java;

COMMIT;