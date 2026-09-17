BEGIN;

ALTER TABLE obra.usuarios
  ADD COLUMN version_sesion integer NOT NULL DEFAULT 0;

ALTER TABLE obra.usuarios
  ADD CONSTRAINT ck_usuarios_version_sesion
    CHECK (version_sesion >= 0);

COMMENT ON COLUMN obra.usuarios.version_sesion IS
  'Versión de autenticación. Se incrementa para invalidar los tokens emitidos con versiones anteriores. No se expone en el perfil público.';

COMMIT;