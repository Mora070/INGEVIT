BEGIN;

-- ============================================================
-- INCIDENCIAS DE MAPA CON RECURSO MULTIMEDIA OPCIONAL
--
-- Una incidencia de mapa puede ser:
--
-- 1. Texto:
--    id_fotografia = NULL
--    id_panoramica = NULL
--
-- 2. Fotografía:
--    id_fotografia != NULL
--    id_panoramica = NULL
--
-- 3. Panorámica 360:
--    id_fotografia = NULL
--    id_panoramica != NULL
--
-- Nunca puede utilizar fotografía y panorámica simultáneamente.
-- Las incidencias de plano no admiten estos vínculos.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Columnas opcionales en incidencias
-- ------------------------------------------------------------

ALTER TABLE obra.incidencias
    ADD COLUMN id_fotografia uuid,
    ADD COLUMN id_panoramica uuid;


-- ------------------------------------------------------------
-- 2. Pares únicos para poder garantizar que el recurso
--    multimedia pertenece al mismo proyecto que la incidencia.
--
-- Aunque los identificadores individuales ya puedan ser únicos,
-- estos índices permiten crear las claves foráneas compuestas:
--
-- (id_proyecto, id_fotografia)
-- (id_proyecto, id_panoramica)
-- ------------------------------------------------------------

ALTER TABLE obra.fotografias
    ADD CONSTRAINT uq_fotografias_proyecto_fotografia
    UNIQUE (id_proyecto, id_fotografia);

ALTER TABLE obra.panoramicas
    ADD CONSTRAINT uq_panoramicas_proyecto_panoramica
    UNIQUE (id_proyecto, id_panoramica);


-- ------------------------------------------------------------
-- 3. Claves foráneas
--
-- La relación compuesta impide asociar por error una fotografía
-- o panorámica perteneciente a otro proyecto.
--
-- RESTRICT impide eliminar un recurso mientras una incidencia
-- siga dependiendo de él.
-- ------------------------------------------------------------

ALTER TABLE obra.incidencias
    ADD CONSTRAINT fk_incidencias_fotografia_proyecto
    FOREIGN KEY (
        id_proyecto,
        id_fotografia
    )
    REFERENCES obra.fotografias (
        id_proyecto,
        id_fotografia
    )
    ON DELETE RESTRICT;

ALTER TABLE obra.incidencias
    ADD CONSTRAINT fk_incidencias_panoramica_proyecto
    FOREIGN KEY (
        id_proyecto,
        id_panoramica
    )
    REFERENCES obra.panoramicas (
        id_proyecto,
        id_panoramica
    )
    ON DELETE RESTRICT;


-- ------------------------------------------------------------
-- 4. Una incidencia no puede tener fotografía y panorámica
--    al mismo tiempo.
-- ------------------------------------------------------------

ALTER TABLE obra.incidencias
    ADD CONSTRAINT ck_incidencias_multimedia_exclusiva
    CHECK (
        NOT (
            id_fotografia IS NOT NULL
            AND id_panoramica IS NOT NULL
        )
    );


-- ------------------------------------------------------------
-- 5. Multimedia solamente para incidencias creadas en el mapa.
--
-- Si cualquiera de las dos relaciones multimedia está presente:
-- - no existe plano
-- - no existe página
-- - no existen coordenadas X/Y
-- - sí existe latitud/longitud
--
-- Esto complementa la restricción de contexto que ya existe.
-- ------------------------------------------------------------

ALTER TABLE obra.incidencias
    ADD CONSTRAINT ck_incidencias_multimedia_solo_mapa
    CHECK (
        (
            id_fotografia IS NULL
            AND id_panoramica IS NULL
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


-- ------------------------------------------------------------
-- 6. Documentación
-- ------------------------------------------------------------

COMMENT ON COLUMN obra.incidencias.id_fotografia IS
    'Fotografía existente del mismo proyecto vinculada opcionalmente a una incidencia de mapa.';

COMMENT ON COLUMN obra.incidencias.id_panoramica IS
    'Panorámica 360 existente del mismo proyecto vinculada opcionalmente a una incidencia de mapa.';

COMMENT ON CONSTRAINT ck_incidencias_multimedia_exclusiva
ON obra.incidencias IS
    'Una incidencia puede vincular una fotografía o una panorámica, pero nunca ambas.';

COMMENT ON CONSTRAINT ck_incidencias_multimedia_solo_mapa
ON obra.incidencias IS
    'Las relaciones multimedia solamente están permitidas en incidencias geográficas de mapa.';

COMMIT;