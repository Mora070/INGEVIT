import {
    useEffect,
    useState,
} from 'react';

import type {
    MouseEvent,
} from 'react';

import {
    actualizarProyecto,
} from '../../api/proyectos.api';

import type {
    DatosActualizarProyecto,
} from '../../api/proyectos.api';

import type {
    EstadoProyecto,
    Proyecto,
} from '../../types/proyecto';

import {
    ApiError,
} from '../../../../shared/api/http';

import {
    ProjectLocationPicker,
} from '../ProjectLocationPicker/ProjectLocationPicker';

import styles from './EditProjectModal.module.css';

interface EditProjectModalProps {
    proyecto: Proyecto;

    onCerrar: () => void;

    onActualizado: (
        proyecto: Proyecto,
    ) => void;
}

export function EditProjectModal({
    proyecto,
    onCerrar,
    onActualizado,
}: EditProjectModalProps) {
    const [
        nombre,
        setNombre,
    ] = useState(
        proyecto.nombre,
    );

    const [
        descripcion,
        setDescripcion,
    ] = useState(
        proyecto.descripcion,
    );

    const [
        direccion,
        setDireccion,
    ] = useState(
        proyecto.direccion,
    );

    const [
        contratante,
        setContratante,
    ] = useState(
        proyecto.contratante,
    );

    const [
        fechaInicio,
        setFechaInicio,
    ] = useState(
        proyecto.fecha_inicio,
    );

    const [
        fechaFinalizacion,
        setFechaFinalizacion,
    ] = useState(
        proyecto.fecha_finalizacion ??
        '',
    );

    const [
        estadoProyecto,
        setEstadoProyecto,
    ] = useState<
        EstadoProyecto
    >(
        proyecto.estado_proyecto,
    );

    const [
        latitud,
        setLatitud,
    ] = useState<
        number | null
    >(
        proyecto.latitud,
    );

    const [
        longitud,
        setLongitud,
    ] = useState<
        number | null
    >(
        proyecto.longitud,
    );

    const [
        guardando,
        setGuardando,
    ] = useState(
        false,
    );

    const [
        error,
        setError,
    ] = useState<
        string | null
    >(
        null,
    );

    useEffect(() => {
        function manejarEscape(
            event: KeyboardEvent,
        ) {
            if (
                event.key ===
                'Escape' &&
                !guardando
            ) {
                onCerrar();
            }
        }

        window.addEventListener(
            'keydown',
            manejarEscape,
        );

        const overflowAnterior =
            document.body.style
                .overflow;

        document.body.style.overflow =
            'hidden';

        return () => {
            window.removeEventListener(
                'keydown',
                manejarEscape,
            );

            document.body.style.overflow =
                overflowAnterior;
        };
    }, [
        guardando,
        onCerrar,
    ]);

    const nombreValido =
        nombre.trim().length >
        0;

    const descripcionValida =
        descripcion.trim().length >
        0;

    const direccionValida =
        direccion.trim().length >
        0;

    const contratanteValido =
        contratante.trim().length >
        0;

    const fechaInicioValida =
        fechaInicio.trim().length >
        0;

    const fechasValidas =
        !fechaFinalizacion ||
        fechaFinalizacion >=
        fechaInicio;


    const coordenadasValidas =
        latitud !== null &&
        longitud !== null &&
        Number.isFinite(latitud) &&
        Number.isFinite(longitud) &&
        latitud >= -90 &&
        latitud <= 90 &&
        longitud >= -180 &&
        longitud <= 180;


    const formularioValido =
        nombreValido &&
        descripcionValida &&
        direccionValida &&
        contratanteValido &&
        fechaInicioValida &&
        fechasValidas &&
        coordenadasValidas;

    function cambiarUbicacion(
        nuevaLatitud: number,
        nuevaLongitud: number,
    ) {
        setLatitud(
            nuevaLatitud,
        );

        setLongitud(
            nuevaLongitud,
        );

        setError(
            null,
        );
    }

    function limpiarUbicacion() {
        setLatitud(
            null,
        );

        setLongitud(
            null,
        );
    }

    async function guardar() {
        if (
            !formularioValido ||
            guardando
        ) {
            return;
        }

        setGuardando(
            true,
        );

        setError(
            null,
        );

        try {
            const datos:
                DatosActualizarProyecto = {
                nombre:
                    nombre.trim(),

                descripcion:
                    descripcion.trim(),

                direccion:
                    direccion.trim(),

                contratante:
                    contratante.trim(),

                fecha_inicio:
                    fechaInicio,

                fecha_finalizacion:
                    fechaFinalizacion ||
                    null,

                estado_proyecto:
                    estadoProyecto,

                latitud,

                longitud,
            };

            const actualizado =
                await actualizarProyecto(
                    proyecto.id_proyecto,
                    datos,
                );

            onActualizado(
                actualizado,
            );
        } catch (
        errorObtenido
        ) {
            if (
                errorObtenido instanceof
                ApiError
            ) {
                setError(
                    errorObtenido.message,
                );
            } else {
                setError(
                    'No fue posible actualizar el proyecto.',
                );
            }
        } finally {
            setGuardando(
                false,
            );
        }
    }

    function cerrarDesdeFondo(
        event: MouseEvent<
            HTMLDivElement
        >,
    ) {
        if (
            event.target ===
            event.currentTarget &&
            !guardando
        ) {
            onCerrar();
        }
    }

    return (
        <div
            className={
                styles.overlay
            }
            role="presentation"
            onMouseDown={
                cerrarDesdeFondo
            }
        >
            <section
                className={
                    styles.modal
                }
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-project-title"
            >
                <header
                    className={
                        styles.header
                    }
                >
                    <div>
                        <span
                            className={
                                styles.eyebrow
                            }
                        >
                            Proyecto
                        </span>

                        <h2
                            id="edit-project-title"
                        >
                            Editar proyecto
                        </h2>

                        <p>
                            Actualiza la información general y la ubicación del proyecto.
                        </p>
                    </div>

                    <button
                        className={
                            styles.closeButton
                        }
                        type="button"
                        onClick={
                            onCerrar
                        }
                        disabled={
                            guardando
                        }
                        aria-label="Cerrar"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                d="M6 6l12 12"
                            />

                            <path
                                d="M18 6 6 18"
                            />
                        </svg>
                    </button>
                </header>

                <div
                    className={
                        styles.body
                    }
                >
                    <div
                        className={
                            styles.grid
                        }
                    >
                        <label
                            className={
                                styles.field
                            }
                        >
                            <span>
                                Nombre
                            </span>

                            <input
                                type="text"
                                value={
                                    nombre
                                }
                                onChange={(
                                    event,
                                ) => {
                                    setNombre(
                                        event.target.value,
                                    );
                                }}
                                disabled={
                                    guardando
                                }
                                maxLength={
                                    150
                                }
                            />
                        </label>

                        <label
                            className={
                                styles.field
                            }
                        >
                            <span>
                                Contratante
                            </span>

                            <input
                                type="text"
                                value={
                                    contratante
                                }
                                onChange={(
                                    event,
                                ) => {
                                    setContratante(
                                        event.target.value,
                                    );
                                }}
                                disabled={
                                    guardando
                                }
                                maxLength={
                                    150
                                }
                            />
                        </label>

                        <label
                            className={`${styles.field} ${styles.fullWidth}`}
                        >
                            <span>
                                Descripción
                            </span>

                            <textarea
                                value={
                                    descripcion
                                }
                                onChange={(
                                    event,
                                ) => {
                                    setDescripcion(
                                        event.target.value,
                                    );
                                }}
                                disabled={
                                    guardando
                                }
                                rows={
                                    4
                                }
                                maxLength={
                                    1000
                                }
                            />
                        </label>

                        <label
                            className={`${styles.field} ${styles.fullWidth}`}
                        >
                            <span>
                                Dirección
                            </span>

                            <input
                                type="text"
                                value={
                                    direccion
                                }

                                onChange={(event) => {
                                    setDireccion(event.target.value);

                                    // La dirección cambió manualmente.
                                    // La ubicación anterior debe confirmarse de nuevo.
                                    setLatitud(null);
                                    setLongitud(null);
                                    setError(null);
                                }}

                                disabled={
                                    guardando
                                }
                                maxLength={
                                    250
                                }
                            />
                        </label>

                        <label
                            className={
                                styles.field
                            }
                        >
                            <span>
                                Fecha de inicio
                            </span>

                            <input
                                type="date"
                                value={
                                    fechaInicio
                                }
                                onChange={(
                                    event,
                                ) => {
                                    setFechaInicio(
                                        event.target.value,
                                    );
                                }}
                                disabled={
                                    guardando
                                }
                            />
                        </label>

                        <label
                            className={
                                styles.field
                            }
                        >
                            <span>
                                Fecha de finalización
                            </span>

                            <input
                                type="date"
                                value={
                                    fechaFinalizacion
                                }
                                min={
                                    fechaInicio ||
                                    undefined
                                }
                                onChange={(
                                    event,
                                ) => {
                                    setFechaFinalizacion(
                                        event.target.value,
                                    );
                                }}
                                disabled={
                                    guardando
                                }
                            />
                        </label>

                        <label
                            className={
                                styles.field
                            }
                        >
                            <span>
                                Estado
                            </span>

                            <select
                                value={
                                    estadoProyecto
                                }
                                onChange={(
                                    event,
                                ) => {
                                    setEstadoProyecto(
                                        event.target
                                            .value as EstadoProyecto,
                                    );
                                }}
                                disabled={
                                    guardando
                                }
                            >
                                <option
                                    value="ACTIVA"
                                >
                                    Activa
                                </option>

                                <option
                                    value="PAUSA"
                                >
                                    En pausa
                                </option>

                                <option
                                    value="FINALIZADA"
                                >
                                    Finalizada
                                </option>
                            </select>
                        </label>

                        <div
                            className={
                                styles.field
                            }
                        />

                        <div
                            className={
                                styles.fullWidth
                            }
                        >
                            <ProjectLocationPicker
                                direccion={
                                    direccion
                                }
                                latitud={
                                    latitud
                                }
                                longitud={
                                    longitud
                                }
                                disabled={
                                    guardando
                                }
                                onDireccionChange={(
                                    nuevaDireccion,
                                ) => {
                                    setDireccion(
                                        nuevaDireccion,
                                    );
                                }}
                                onChange={
                                    cambiarUbicacion
                                }
                                onLimpiar={
                                    limpiarUbicacion
                                }
                            />
                        </div>
                    </div>

                    {!fechasValidas && (
                        <div
                            className={
                                styles.error
                            }
                            role="alert"
                        >
                            La fecha de finalización no puede ser anterior a la fecha de inicio.
                        </div>
                    )}

                    {!coordenadasValidas && (
                        <div
                            className={
                                styles.error
                            }
                            role="alert"
                        >
                            Debes seleccionar una ubicación para guardar el proyecto. Haz doble clic en el mapa o utiliza «Buscar dirección» para colocar el marcador.
                        </div>
                    )}

                    {error && (
                        <div
                            className={
                                styles.error
                            }
                            role="alert"
                        >
                            {
                                error
                            }
                        </div>
                    )}
                </div>

                <footer
                    className={
                        styles.footer
                    }
                >
                    <button
                        className={
                            styles.cancelButton
                        }
                        type="button"
                        onClick={
                            onCerrar
                        }
                        disabled={
                            guardando
                        }
                    >
                        Cancelar
                    </button>

                    <button
                        className={
                            styles.saveButton
                        }
                        type="button"
                        onClick={() => {
                            void guardar();
                        }}
                        disabled={
                            !formularioValido ||
                            guardando
                        }
                    >
                        {guardando
                            ? 'Guardando...'
                            : 'Guardar cambios'}
                    </button>
                </footer>
            </section>
        </div>
    );
}