BEGIN;

-- Apoya el filtro por plano y página y el orden estable del listado.
CREATE INDEX idx_incidencias_plano_pagina_fecha_id
ON obra.incidencias (
  id_plano,
  numero_pagina,
  fecha_creacion DESC,
  id_incidencia DESC
);

COMMIT;