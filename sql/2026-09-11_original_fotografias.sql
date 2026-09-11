-- Una fotografía tendrá dos archivos:
-- s3_key: versión optimizada.
-- original_s3_key: original sin modificaciones.
--
-- Esta migración requiere que la tabla esté vacía.

BEGIN;

-- Impide inserciones entre la comprobación y el cambio de estructura.
LOCK TABLE obra.fotografias IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM obra.fotografias) THEN
        RAISE EXCEPTION
            'La tabla fotografias debe estar vacía para ejecutar esta migración.';
    END IF;
END;
$$;

ALTER TABLE obra.fotografias
    ADD COLUMN original_s3_key text NOT NULL,

    ADD CONSTRAINT fotografias_original_s3_key_unique
        UNIQUE (original_s3_key),

    ADD CONSTRAINT fotografias_original_s3_key_check
        CHECK (original_s3_key LIKE 'fotografias/_%'),

    ADD CONSTRAINT fotografias_claves_distintas_check
        CHECK (original_s3_key <> s3_key);

COMMENT ON COLUMN obra.fotografias.original_s3_key IS
    'Clave del archivo original conservado sin modificar sus bytes.';

COMMENT ON COLUMN obra.fotografias.s3_key IS
    'Clave de la versión optimizada para mostrar en la aplicación.';

COMMENT ON COLUMN obra.fotografias.url IS
    'Referencia de acceso a la versión optimizada.';

COMMIT;