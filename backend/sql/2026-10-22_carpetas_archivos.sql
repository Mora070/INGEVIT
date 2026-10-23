BEGIN;
CREATE TABLE IF NOT EXISTS obra.carpeta_archivos (
 id_archivo uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 id_proyecto uuid NOT NULL,
 id_carpeta uuid NOT NULL,
 id_usuario_subida uuid NOT NULL REFERENCES obra.usuarios(id_usuario),
 nombre text NOT NULL CHECK (length(nombre) BETWEEN 1 AND 255),
 extension text NOT NULL CHECK (extension IN ('pdf','xls','xlsx','dwg')),
 mime_type text NOT NULL,
 tamano integer NOT NULL CHECK (tamano > 0 AND tamano <= 52428800),
 s3_key text NOT NULL UNIQUE,
 fecha_subida timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (id_proyecto,id_carpeta) REFERENCES obra.carpetas(id_proyecto,id_carpeta) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_carpeta_archivos_carpeta ON obra.carpeta_archivos(id_proyecto,id_carpeta);
CREATE OR REPLACE FUNCTION obra.encolar_archivo_carpeta_eliminado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO obra.archivos_pendientes_eliminacion(s3_key) VALUES (OLD.s3_key) ON CONFLICT DO NOTHING;
 RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS carpeta_archivos_eliminacion ON obra.carpeta_archivos;
CREATE TRIGGER carpeta_archivos_eliminacion AFTER DELETE ON obra.carpeta_archivos
 FOR EACH ROW EXECUTE FUNCTION obra.encolar_archivo_carpeta_eliminado();
COMMIT;
