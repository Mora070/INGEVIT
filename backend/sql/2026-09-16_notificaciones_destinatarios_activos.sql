BEGIN;

CREATE OR REPLACE FUNCTION obra.notificar_incidencia_creada()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    INSERT INTO obra.notificaciones (
        id_receptor,
        id_actor,
        id_proyecto,
        id_incidencia,
        tipo,
        titulo,
        mensaje
    )
    SELECT
        destinatario.id_usuario,
        NEW.id_creador,
        NEW.id_proyecto,
        NEW.id_incidencia,
        'INCIDENCIA_CREADA',
        'Incidencia creada',
        NEW.titulo
    FROM (
        SELECT proyecto.id_propietario AS id_usuario
        FROM obra.proyectos AS proyecto
        WHERE proyecto.id_proyecto = NEW.id_proyecto

        UNION

        SELECT colaboracion.id_usuario
        FROM obra.usuario_proyecto AS colaboracion
        WHERE colaboracion.id_proyecto = NEW.id_proyecto
    ) AS destinatario
    JOIN obra.usuarios AS usuario
      ON usuario.id_usuario = destinatario.id_usuario
    WHERE destinatario.id_usuario <> NEW.id_creador
      AND usuario.estado = 'ACTIVO';

    RETURN NEW;
END;
$function$;

COMMIT;