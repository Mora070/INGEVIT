BEGIN;

-- Permitir validar que la capa y la incidencia
-- pertenezcan al mismo proyecto.
ALTER TABLE obra.capas
    ADD CONSTRAINT uq_capas_proyecto_id
    UNIQUE (id_proyecto, id_capa);

-- Una incidencia puede pertenecer a una capa
-- o ser una incidencia general del mapa.
ALTER TABLE obra.incidencias
    ADD COLUMN id_capa uuid;

-- Impedir que una incidencia de plano
-- se asocie a una capa del mapa.
ALTER TABLE obra.incidencias
    ADD CONSTRAINT ck_incidencias_capa_contexto
    CHECK (
        id_capa IS NULL
        OR id_plano IS NULL
    );

-- Validar que la capa pertenezca
-- al mismo proyecto que la incidencia.
--
-- Al eliminar una capa, PostgreSQL eliminará
-- únicamente las incidencias vinculadas a ella.
ALTER TABLE obra.incidencias
    ADD CONSTRAINT fk_incidencias_capa_proyecto
    FOREIGN KEY (id_proyecto, id_capa)
    REFERENCES obra.capas (id_proyecto, id_capa)
    ON DELETE CASCADE;

-- Facilitar la búsqueda y eliminación
-- de incidencias por capa.
CREATE INDEX idx_incidencias_capa_proyecto
    ON obra.incidencias (id_proyecto, id_capa)
    WHERE id_capa IS NOT NULL;

COMMENT ON COLUMN obra.incidencias.id_capa IS
    'Capa geográfica asociada a la incidencia. NULL para incidencias generales del mapa o incidencias de plano.';

COMMIT;