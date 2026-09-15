BEGIN;

-- Las tareas nuevas quedan disponibles inmediatamente.
-- Las existentes también reciben una fecha inicial de disponibilidad.
ALTER TABLE obra.archivos_pendientes_eliminacion
ADD COLUMN fecha_proximo_intento timestamptz NOT NULL
    DEFAULT CURRENT_TIMESTAMP;

COMMENT ON COLUMN
    obra.archivos_pendientes_eliminacion.fecha_proximo_intento
IS
    'Momento a partir del cual un trabajador puede volver a seleccionar la tarea.';

-- Facilita seleccionar tareas disponibles en orden estable.
CREATE INDEX idx_archivos_pendientes_disponibilidad
ON obra.archivos_pendientes_eliminacion (
    fecha_proximo_intento,
    fecha_creacion,
    s3_key
);

-- El nuevo índice sustituirá al anterior en la selección del trabajador.
DROP INDEX obra.idx_archivos_pendientes_fecha_clave;

-- Permite aplazar tareas sin conceder modificación de sus claves.
GRANT UPDATE (fecha_proximo_intento)
ON obra.archivos_pendientes_eliminacion
TO user_java;

COMMIT;