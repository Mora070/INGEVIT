BEGIN;

ALTER TABLE obra.fotografias
ADD COLUMN es_portada boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX fotografias_portada_unica_por_proyecto
ON obra.fotografias (id_proyecto)
WHERE es_portada = true;

COMMENT ON COLUMN obra.fotografias.es_portada IS
'Indica si la fotografía está seleccionada como portada del proyecto. Solo puede existir una portada por proyecto.';

COMMIT;