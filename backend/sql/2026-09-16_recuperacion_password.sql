BEGIN;

CREATE TABLE obra.recuperaciones_password (
    id_usuario uuid PRIMARY KEY
        REFERENCES obra.usuarios (id_usuario)
        ON DELETE CASCADE,

    token_hash text NOT NULL,

    version_sesion integer NOT NULL,

    fecha_creacion timestamptz NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    fecha_expiracion timestamptz NOT NULL,

    CONSTRAINT uq_recuperaciones_password_token
        UNIQUE (token_hash),

    CONSTRAINT ck_recuperaciones_password_hash
        CHECK (
            length(token_hash) = 64
            AND token_hash ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT ck_recuperaciones_password_version
        CHECK (version_sesion >= 0),

    CONSTRAINT ck_recuperaciones_password_fechas
        CHECK (fecha_expiracion > fecha_creacion)
);

COMMENT ON TABLE obra.recuperaciones_password IS
    'Solicitud vigente de recuperación por usuario. Se elimina al consumirla correctamente.';

COMMENT ON COLUMN obra.recuperaciones_password.token_hash IS
    'SHA-256 hexadecimal de un token aleatorio criptográfico. Nunca contiene el token original.';

COMMENT ON COLUMN obra.recuperaciones_password.version_sesion IS
    'Versión de sesión al emitir la solicitud. Si cambia, la solicitud deja de ser válida.';

COMMENT ON COLUMN obra.recuperaciones_password.fecha_expiracion IS
    'Vencimiento comprobado por PostgreSQL durante el consumo del token.';

CREATE INDEX idx_recuperaciones_password_expiracion
    ON obra.recuperaciones_password (fecha_expiracion);

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE obra.recuperaciones_password
    TO user_java;

COMMIT;