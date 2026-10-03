BEGIN;

/*
 * ============================================================
 * SOPORTE DE INTEGRIDAD PARA PLANOS
 * ============================================================
 *
 * Fotografías y panorámicas ya poseen una restricción UNIQUE
 * con el orden:
 *
 *   (id_proyecto, id_recurso)
 *
 * Planos actualmente la posee en orden inverso.
 * Agregamos esta para poder utilizar una FK compuesta uniforme
 * desde la organización de carpetas.
 */
ALTER TABLE obra.planos
    ADD CONSTRAINT uq_planos_proyecto_plano
    UNIQUE (
        id_proyecto,
        id_plano
    );


/*
 * ============================================================
 * CARPETAS
 * ============================================================
 */
CREATE TABLE obra.carpetas (
    id_carpeta uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    id_proyecto uuid NOT NULL
        REFERENCES obra.proyectos(id_proyecto)
        ON DELETE CASCADE,

    /*
     * NULL = carpeta ubicada en la raíz del proyecto.
     *
     * La FK compuesta definida más abajo garantiza
     * que una carpeta hija pertenezca al mismo proyecto
     * que su carpeta padre.
     */
    id_carpeta_padre uuid,

    id_usuario_creacion uuid NOT NULL
        REFERENCES obra.usuarios(id_usuario)
        ON DELETE RESTRICT,

    nombre text NOT NULL,

    fecha_creacion timestamptz NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    fecha_actualizacion timestamptz NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_carpetas_nombre
        CHECK (
            btrim(nombre) <> ''
            AND char_length(
                btrim(nombre)
            ) <= 150
        ),

    CONSTRAINT ck_carpetas_no_autoreferencia
        CHECK (
            id_carpeta_padre IS NULL
            OR id_carpeta_padre <> id_carpeta
        ),

    CONSTRAINT ck_carpetas_fechas
        CHECK (
            fecha_actualizacion >=
            fecha_creacion
        ),

    /*
     * Necesaria para poder crear una FK compuesta
     * que incluya el proyecto.
     */
    CONSTRAINT uq_carpetas_proyecto_carpeta
        UNIQUE (
            id_proyecto,
            id_carpeta
        ),

    CONSTRAINT fk_carpetas_padre_mismo_proyecto
        FOREIGN KEY (
            id_proyecto,
            id_carpeta_padre
        )
        REFERENCES obra.carpetas (
            id_proyecto,
            id_carpeta
        )
        ON DELETE CASCADE
);


/*
 * No permite dos carpetas raíz con el mismo nombre
 * dentro del mismo proyecto.
 *
 * La comparación ignora mayúsculas y espacios
 * exteriores.
 */
CREATE UNIQUE INDEX uq_carpetas_raiz_nombre
    ON obra.carpetas (
        id_proyecto,
        lower(
            btrim(nombre)
        )
    )
    WHERE id_carpeta_padre IS NULL;


/*
 * No permite dos carpetas hermanas con el mismo
 * nombre dentro de la misma carpeta padre.
 */
CREATE UNIQUE INDEX uq_carpetas_hijas_nombre
    ON obra.carpetas (
        id_proyecto,
        id_carpeta_padre,
        lower(
            btrim(nombre)
        )
    )
    WHERE id_carpeta_padre IS NOT NULL;


CREATE INDEX idx_carpetas_proyecto_padre
    ON obra.carpetas (
        id_proyecto,
        id_carpeta_padre,
        nombre,
        id_carpeta
    );


CREATE INDEX idx_carpetas_usuario_creacion
    ON obra.carpetas (
        id_usuario_creacion
    );


/*
 * ============================================================
 * FOTOGRAFÍAS EN CARPETAS
 * ============================================================
 *
 * No se duplica ni se mueve físicamente la fotografía.
 * Únicamente se crea una relación de organización.
 *
 * Si la carpeta desaparece, se elimina esta relación,
 * pero obra.fotografias permanece intacta.
 */
CREATE TABLE obra.carpeta_fotografias (
    id_proyecto uuid NOT NULL,

    id_carpeta uuid NOT NULL,

    id_fotografia uuid NOT NULL,

    id_usuario_agrego uuid NOT NULL
        REFERENCES obra.usuarios(id_usuario)
        ON DELETE RESTRICT,

    fecha_agregada timestamptz NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (
        id_carpeta,
        id_fotografia
    ),

    /*
     * Una fotografía puede estar organizada
     * como máximo en una carpeta.
     */
    CONSTRAINT uq_carpeta_fotografias_recurso
        UNIQUE (
            id_fotografia
        ),

    CONSTRAINT fk_carpeta_fotografias_carpeta
        FOREIGN KEY (
            id_proyecto,
            id_carpeta
        )
        REFERENCES obra.carpetas (
            id_proyecto,
            id_carpeta
        )
        ON DELETE CASCADE,

    CONSTRAINT fk_carpeta_fotografias_recurso
        FOREIGN KEY (
            id_proyecto,
            id_fotografia
        )
        REFERENCES obra.fotografias (
            id_proyecto,
            id_fotografia
        )
        ON DELETE CASCADE
);


CREATE INDEX idx_carpeta_fotografias_carpeta
    ON obra.carpeta_fotografias (
        id_proyecto,
        id_carpeta,
        fecha_agregada,
        id_fotografia
    );


/*
 * ============================================================
 * PANORÁMICAS 360 EN CARPETAS
 * ============================================================
 */
CREATE TABLE obra.carpeta_panoramicas (
    id_proyecto uuid NOT NULL,

    id_carpeta uuid NOT NULL,

    id_panoramica uuid NOT NULL,

    id_usuario_agrego uuid NOT NULL
        REFERENCES obra.usuarios(id_usuario)
        ON DELETE RESTRICT,

    fecha_agregada timestamptz NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (
        id_carpeta,
        id_panoramica
    ),

    CONSTRAINT uq_carpeta_panoramicas_recurso
        UNIQUE (
            id_panoramica
        ),

    CONSTRAINT fk_carpeta_panoramicas_carpeta
        FOREIGN KEY (
            id_proyecto,
            id_carpeta
        )
        REFERENCES obra.carpetas (
            id_proyecto,
            id_carpeta
        )
        ON DELETE CASCADE,

    CONSTRAINT fk_carpeta_panoramicas_recurso
        FOREIGN KEY (
            id_proyecto,
            id_panoramica
        )
        REFERENCES obra.panoramicas (
            id_proyecto,
            id_panoramica
        )
        ON DELETE CASCADE
);


CREATE INDEX idx_carpeta_panoramicas_carpeta
    ON obra.carpeta_panoramicas (
        id_proyecto,
        id_carpeta,
        fecha_agregada,
        id_panoramica
    );


/*
 * ============================================================
 * PLANOS EN CARPETAS
 * ============================================================
 */
CREATE TABLE obra.carpeta_planos (
    id_proyecto uuid NOT NULL,

    id_carpeta uuid NOT NULL,

    id_plano uuid NOT NULL,

    id_usuario_agrego uuid NOT NULL
        REFERENCES obra.usuarios(id_usuario)
        ON DELETE RESTRICT,

    fecha_agregada timestamptz NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (
        id_carpeta,
        id_plano
    ),

    CONSTRAINT uq_carpeta_planos_recurso
        UNIQUE (
            id_plano
        ),

    CONSTRAINT fk_carpeta_planos_carpeta
        FOREIGN KEY (
            id_proyecto,
            id_carpeta
        )
        REFERENCES obra.carpetas (
            id_proyecto,
            id_carpeta
        )
        ON DELETE CASCADE,

    CONSTRAINT fk_carpeta_planos_recurso
        FOREIGN KEY (
            id_proyecto,
            id_plano
        )
        REFERENCES obra.planos (
            id_proyecto,
            id_plano
        )
        ON DELETE CASCADE
);


CREATE INDEX idx_carpeta_planos_carpeta
    ON obra.carpeta_planos (
        id_proyecto,
        id_carpeta,
        fecha_agregada,
        id_plano
    );


/*
 * ============================================================
 * COMENTARIOS
 * ============================================================
 */

COMMENT ON TABLE obra.carpetas IS
    'Estructura jerárquica de carpetas de un proyecto para organizar fotografías, panorámicas 360 y planos existentes.';

COMMENT ON COLUMN obra.carpetas.id_carpeta_padre IS
    'Carpeta contenedora. NULL representa una carpeta ubicada en la raíz del proyecto.';

COMMENT ON COLUMN obra.carpetas.id_usuario_creacion IS
    'Propietario o colaborador que creó la carpeta.';

COMMENT ON COLUMN obra.carpetas.fecha_actualizacion IS
    'El backend debe actualizar esta fecha al renombrar o mover la carpeta.';


COMMENT ON TABLE obra.carpeta_fotografias IS
    'Organización de fotografías existentes dentro de carpetas. No representa una copia física del archivo.';

COMMENT ON TABLE obra.carpeta_panoramicas IS
    'Organización de panorámicas 360 existentes dentro de carpetas. No representa una copia física del archivo.';

COMMENT ON TABLE obra.carpeta_planos IS
    'Organización de planos existentes dentro de carpetas. No representa una copia física del archivo.';


/*
 * ============================================================
 * PERMISOS
 * ============================================================
 */

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE obra.carpetas
    TO user_java;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE obra.carpeta_fotografias
    TO user_java;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE obra.carpeta_panoramicas
    TO user_java;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE obra.carpeta_planos
    TO user_java;

COMMIT;