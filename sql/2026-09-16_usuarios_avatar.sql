BEGIN;

ALTER TABLE obra.usuarios
  ADD COLUMN foto_perfil_key text;

ALTER TABLE obra.usuarios
  ADD CONSTRAINT uq_usuarios_foto_perfil_key
    UNIQUE (foto_perfil_key),

  ADD CONSTRAINT ck_usuarios_foto_perfil_pareja
    CHECK (
      (
        foto_perfil_url IS NULL
        AND foto_perfil_key IS NULL
      )
      OR
      (
        foto_perfil_url IS NOT NULL
        AND foto_perfil_key IS NOT NULL
        AND btrim(foto_perfil_url) <> ''
      )
    ),

  ADD CONSTRAINT ck_usuarios_foto_perfil_key
    CHECK (
      foto_perfil_key IS NULL
      OR (
        length(foto_perfil_key) = 50
        AND foto_perfil_key ~
          '^avatares/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
      )
    );

COMMENT ON COLUMN obra.usuarios.foto_perfil_key IS
  'Clave interna del avatar WebP optimizado. No se devuelve en el perfil público. NULL cuando no existe avatar.';

COMMIT;