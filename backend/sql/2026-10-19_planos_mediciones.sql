BEGIN;
CREATE TABLE IF NOT EXISTS obra.plano_mediciones (
  id_plano uuid NOT NULL REFERENCES obra.planos(id_plano) ON DELETE CASCADE,
  numero_pagina integer NOT NULL CHECK (numero_pagina > 0),
  version integer NOT NULL CHECK (version > 0),
  estado jsonb NOT NULL CHECK (jsonb_typeof(estado) = 'object'),
  id_editor uuid NOT NULL REFERENCES obra.usuarios(id_usuario),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id_plano, numero_pagina)
);
COMMIT;
