BEGIN;

-- Metadato obtenido al interpretar el PDF.
-- No debe proceder de un campo enviado por el cliente.
ALTER TABLE obra.planos
  ADD COLUMN numero_paginas integer;

ALTER TABLE obra.planos
  ADD CONSTRAINT ck_planos_numero_paginas
  CHECK (numero_paginas >= 1);

COMMENT ON COLUMN obra.planos.numero_paginas IS
  'Número de páginas detectado por el backend al inspeccionar el PDF original.';

COMMIT;