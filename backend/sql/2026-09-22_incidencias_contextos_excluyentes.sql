BEGIN;

-- Sustituye la regla anterior sin modificar los registros existentes.
-- Si existen incidencias con ambos contextos, la validación falla
-- y la transacción no debe confirmarse.
ALTER TABLE obra.incidencias
    DROP CONSTRAINT ck_incidencias_contexto_ubicacion,
    ADD CONSTRAINT ck_incidencias_contexto_ubicacion
    CHECK (
        (
            id_plano IS NOT NULL
            AND numero_pagina IS NOT NULL
            AND coordenada_x IS NOT NULL
            AND coordenada_y IS NOT NULL
            AND latitud IS NULL
            AND longitud IS NULL
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

COMMENT ON CONSTRAINT ck_incidencias_contexto_ubicacion
ON obra.incidencias IS
    'Contextos excluyentes: plano con página y X/Y, o mapa con latitud/longitud.';

COMMENT ON COLUMN obra.incidencias.latitud IS
    'Latitud WGS84. Obligatoria en incidencias de mapa y NULL en incidencias de plano.';

COMMENT ON COLUMN obra.incidencias.longitud IS
    'Longitud WGS84. Obligatoria en incidencias de mapa y NULL en incidencias de plano.';

COMMIT;