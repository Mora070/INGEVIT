BEGIN;

-- Consultar tareas, registrar pendientes y retirar tareas completadas.
GRANT SELECT, INSERT, DELETE
ON TABLE obra.archivos_pendientes_eliminacion
TO user_java;

-- Permiso necesario para seleccionar tareas con bloqueo de fila.
-- Se limita a una columna; no necesitamos modificar las claves.
GRANT UPDATE (fecha_creacion)
ON TABLE obra.archivos_pendientes_eliminacion
TO user_java;

COMMIT;