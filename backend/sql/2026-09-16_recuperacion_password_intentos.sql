BEGIN;

ALTER TABLE obra.recuperaciones_password
    ADD COLUMN intentos_fallidos integer NOT NULL DEFAULT 0;

ALTER TABLE obra.recuperaciones_password
    ADD CONSTRAINT ck_recuperaciones_password_intentos
    CHECK (intentos_fallidos BETWEEN 0 AND 5);

COMMENT ON COLUMN obra.recuperaciones_password.intentos_fallidos IS
    'Intentos incorrectos de la solicitud vigente. Al llegar a cinco no permite consumir el código.';

COMMIT;