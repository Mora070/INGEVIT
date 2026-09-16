BEGIN;

-- Impide confirmar nuevos registros incompletos durante la migración.
LOCK TABLE obra.planos IN ACCESS EXCLUSIVE MODE;

-- No inventamos cantidades para registros que carezcan del dato.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM obra.planos
    WHERE numero_paginas IS NULL
  ) THEN
    RAISE EXCEPTION
      'Existen planos sin numero_paginas. Deben inspeccionarse sus PDF antes de completar la migración.';
  END IF;
END;
$$;

ALTER TABLE obra.planos
  ALTER COLUMN numero_paginas SET NOT NULL;

COMMIT;