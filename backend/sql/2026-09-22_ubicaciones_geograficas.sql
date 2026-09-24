BEGIN;

-- ============================================================
-- FOTOGRAFÍAS
-- Las coordenadas deben estar ambas presentes o ambas ausentes.
-- No se asignan ubicaciones ficticias a registros existentes.
-- ============================================================

ALTER TABLE obra.fotografias
    ADD COLUMN latitud numeric,
    ADD COLUMN longitud numeric;

ALTER TABLE obra.fotografias
    ADD CONSTRAINT ck_fotografias_ubicacion_geografica
    CHECK (
        (latitud IS NULL AND longitud IS NULL)
        OR
        (
            latitud IS NOT NULL
            AND longitud IS NOT NULL
            AND latitud BETWEEN -90 AND 90
            AND longitud BETWEEN -180 AND 180
        )
    );

COMMENT ON COLUMN obra.fotografias.latitud IS
    'Latitud WGS84 en grados, seleccionada manualmente. No procede del EXIF.';

COMMENT ON COLUMN obra.fotografias.longitud IS
    'Longitud WGS84 en grados, seleccionada manualmente. No procede del EXIF.';


-- ============================================================
-- PANORÁMICAS
-- ============================================================

ALTER TABLE obra.panoramicas
    ADD COLUMN latitud numeric,
    ADD COLUMN longitud numeric;

ALTER TABLE obra.panoramicas
    ADD CONSTRAINT ck_panoramicas_ubicacion_geografica
    CHECK (
        (latitud IS NULL AND longitud IS NULL)
        OR
        (
            latitud IS NOT NULL
            AND longitud IS NOT NULL
            AND latitud BETWEEN -90 AND 90
            AND longitud BETWEEN -180 AND 180
        )
    );

COMMENT ON COLUMN obra.panoramicas.latitud IS
    'Latitud WGS84 en grados, seleccionada manualmente.';

COMMENT ON COLUMN obra.panoramicas.longitud IS
    'Longitud WGS84 en grados, seleccionada manualmente.';


-- ============================================================
-- INCIDENCIAS
-- Conserva coordenada_x/coordenada_y como ubicación en el plano.
-- Latitud/longitud representan exclusivamente ubicación geográfica.
-- ============================================================

ALTER TABLE obra.incidencias
    ADD COLUMN latitud numeric,
    ADD COLUMN longitud numeric;

ALTER TABLE obra.incidencias
    ALTER COLUMN id_plano DROP NOT NULL,
    ALTER COLUMN numero_pagina DROP NOT NULL,
    ALTER COLUMN coordenada_x DROP NOT NULL,
    ALTER COLUMN coordenada_y DROP NOT NULL;

ALTER TABLE obra.incidencias
    ADD CONSTRAINT ck_incidencias_ubicacion_geografica
    CHECK (
        (latitud IS NULL AND longitud IS NULL)
        OR
        (
            latitud IS NOT NULL
            AND longitud IS NOT NULL
            AND latitud BETWEEN -90 AND 90
            AND longitud BETWEEN -180 AND 180
        )
    );

-- Admite únicamente dos contextos completos:
--
-- 1. Plano: plano + página + X/Y.
--    Puede tener además ubicación geográfica.
--
-- 2. Mapa: sin plano, página ni X/Y.
--    Debe tener ubicación geográfica.
--
-- Se conservan las restricciones existentes que validan
-- numero_pagina >= 1 y coordenadas X/Y finitas.

ALTER TABLE obra.incidencias
    ADD CONSTRAINT ck_incidencias_contexto_ubicacion
    CHECK (
        (
            id_plano IS NOT NULL
            AND numero_pagina IS NOT NULL
            AND coordenada_x IS NOT NULL
            AND coordenada_y IS NOT NULL
        )
        OR
        (
            id_plano IS NULL
            AND numero_pagina IS NULL
            AND coordenada_x IS NULL
            AND coordenada_y IS NULL
            AND latitud IS NOT NULL
            AND longitud IS NOT NULL
        )
    );

-- Una incidencia de mapa también debe pertenecer a un proyecto real.
-- La relación compuesta existente con planos se conserva:
-- garantiza que el plano pertenece al mismo proyecto y mantiene
-- ON DELETE CASCADE para las incidencias asociadas al plano.

ALTER TABLE obra.incidencias
    ADD CONSTRAINT fk_incidencias_proyecto
    FOREIGN KEY (id_proyecto)
    REFERENCES obra.proyectos (id_proyecto)
    ON DELETE CASCADE;

COMMENT ON COLUMN obra.incidencias.latitud IS
    'Latitud WGS84 en grados. Obligatoria para incidencias sin plano.';

COMMENT ON COLUMN obra.incidencias.longitud IS
    'Longitud WGS84 en grados. Obligatoria para incidencias sin plano.';

COMMENT ON COLUMN obra.incidencias.coordenada_x IS
    'Posición horizontal dentro del plano; NULL en incidencias de mapa.';

COMMENT ON COLUMN obra.incidencias.coordenada_y IS
    'Posición vertical dentro del plano; NULL en incidencias de mapa.';

COMMENT ON COLUMN obra.incidencias.numero_pagina IS
    'Página del plano, numerada desde 1; NULL en incidencias de mapa.';

COMMIT;