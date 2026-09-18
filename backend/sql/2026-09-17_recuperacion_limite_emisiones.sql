BEGIN;

CREATE TABLE obra.recuperacion_limites (
    id_usuario uuid PRIMARY KEY
        REFERENCES obra.usuarios(id_usuario)
        ON DELETE CASCADE,

    inicio_ventana timestamptz NOT NULL,
    ultima_emision timestamptz NOT NULL,
    emisiones integer NOT NULL,

    CONSTRAINT ck_recuperacion_limites_emisiones
        CHECK (emisiones BETWEEN 1 AND 5),

    CONSTRAINT ck_recuperacion_limites_fechas
        CHECK (ultima_emision >= inicio_ventana)
);

COMMENT ON TABLE obra.recuperacion_limites IS
    'Límite persistente de emisión por cuenta, independiente del consumo del código.';

GRANT SELECT, INSERT, UPDATE
ON TABLE obra.recuperacion_limites
TO user_java;

COMMIT;